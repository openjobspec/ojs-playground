package sse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Handler serves the SSE endpoint.
type Handler struct {
	broadcaster *Broadcaster
}

// NewHandler creates a new SSE handler.
func NewHandler(broadcaster *Broadcaster) *Handler {
	return &Handler{broadcaster: broadcaster}
}

// ServeHTTP handles GET /api/events.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Parse filter from query params
	filter := SubscribeFilter{
		Queue: r.URL.Query().Get("queue"),
		JobID: r.URL.Query().Get("job_id"),
	}
	if types := r.URL.Query().Get("types"); types != "" {
		filter.Types = make(map[string]bool)
		for _, t := range strings.Split(types, ",") {
			filter.Types[strings.TrimSpace(t)] = true
		}
	}

	sub, unsub := h.broadcaster.Subscribe(filter)
	defer unsub()

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	// Keepalive ticker
	keepalive := time.NewTicker(15 * time.Second)
	defer keepalive.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-sub.Ch:
			if !ok {
				return
			}
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "id: %s\nevent: %s\ndata: %s\n\n", event.ID, event.Type, data)
			flusher.Flush()
		case <-keepalive.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			flusher.Flush()
		}
	}
}
