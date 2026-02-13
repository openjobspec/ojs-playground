package proxy

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/openjobspec/ojs-playground/server/internal/history"
	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

// Proxy forwards OJS requests to an external backend and intercepts responses
// to record state changes and broadcast SSE events.
type Proxy struct {
	target      *url.URL
	rp          *httputil.ReverseProxy
	store       history.Store
	broadcaster *sse.Broadcaster
	backendName string
}

// NewProxy creates a reverse proxy that forwards to the given backend URL.
func NewProxy(targetURL string, store history.Store, broadcaster *sse.Broadcaster, backendName string) (*Proxy, error) {
	target, err := url.Parse(targetURL)
	if err != nil {
		return nil, err
	}

	p := &Proxy{
		target:      target,
		store:       store,
		broadcaster: broadcaster,
		backendName: backendName,
	}

	p.rp = &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host
		},
		ModifyResponse: p.modifyResponse,
	}

	return p, nil
}

// ServeHTTP forwards the request through the reverse proxy.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	p.rp.ServeHTTP(w, r)
}

// modifyResponse intercepts mutating responses to record in history and broadcast SSE.
func (p *Proxy) modifyResponse(resp *http.Response) error {
	if !isMutatingEndpoint(resp.Request) {
		return nil
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return err
	}
	resp.Body = io.NopCloser(bytes.NewReader(body))

	// Only process successful responses
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}

	// Extract job data from response
	var result struct {
		Job *struct {
			ID    string `json:"id"`
			Type  string `json:"type"`
			State string `json:"state"`
			Queue string `json:"queue"`
		} `json:"job"`
	}

	if err := json.Unmarshal(body, &result); err != nil || result.Job == nil {
		return nil
	}

	ctx := resp.Request.Context()

	// Record in history store
	if p.store != nil {
		now := time.Now()
		histJob := &history.Job{
			ID:        result.Job.ID,
			Type:      result.Job.Type,
			State:     result.Job.State,
			Queue:     result.Job.Queue,
			Backend:   p.backendName,
			CreatedAt: now,
			UpdatedAt: now,
			Args:      json.RawMessage(`[]`),
		}
		if err := p.store.SaveJob(ctx, histJob); err != nil {
			slog.Warn("failed to save job to history", "err", err, "job_id", result.Job.ID)
		}
	}

	// Broadcast SSE event
	if p.broadcaster != nil {
		eventType := sse.EventJobStateChanged
		switch result.Job.State {
		case "completed":
			eventType = sse.EventJobCompleted
		case "discarded":
			eventType = sse.EventJobDead
		}

		p.broadcaster.Broadcast(sse.Event{
			Type:      eventType,
			Timestamp: time.Now(),
			JobID:     result.Job.ID,
			Queue:     result.Job.Queue,
			Data: map[string]any{
				"job_id": result.Job.ID,
				"type":   result.Job.Type,
				"state":  result.Job.State,
				"queue":  result.Job.Queue,
			},
		})
	}

	return nil
}

// isMutatingEndpoint returns true for endpoints that change job state.
func isMutatingEndpoint(req *http.Request) bool {
	path := req.URL.Path
	method := req.Method

	if method == http.MethodPost && strings.HasSuffix(path, "/jobs") {
		return true
	}
	if method == http.MethodPost && strings.Contains(path, "/workers/") {
		return true // ack, nack, fetch
	}
	if method == http.MethodDelete && strings.Contains(path, "/jobs/") {
		return true // cancel
	}
	return false
}
