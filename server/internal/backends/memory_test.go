package backends

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func newTestBackend() *MemoryBackend {
	return NewMemoryBackend(nil)
}

func doRequest(t *testing.T, handler http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		bodyReader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

func createJob(t *testing.T, r chi.Router, jobType string) *MemoryJob {
	t.Helper()
	body := map[string]any{
		"type": jobType,
		"args": []any{"arg1"},
	}
	rr := doRequest(t, r, "POST", "/jobs", body)
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}
	var resp struct {
		Job MemoryJob `json:"job"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	return &resp.Job
}

func TestCreateJob(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	rr := doRequest(t, r, "POST", "/jobs", map[string]any{
		"type": "email.send",
		"args": []any{"user@test.com"},
	})

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}

	var resp struct {
		Job MemoryJob `json:"job"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if resp.Job.Type != "email.send" {
		t.Errorf("expected type email.send, got %s", resp.Job.Type)
	}
	if resp.Job.State != StateAvailable {
		t.Errorf("expected state available, got %s", resp.Job.State)
	}
	if resp.Job.Queue != "default" {
		t.Errorf("expected queue default, got %s", resp.Job.Queue)
	}
	if resp.Job.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestCreateJobWithOptions(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	rr := doRequest(t, r, "POST", "/jobs", map[string]any{
		"type": "report.generate",
		"args": []any{42},
		"options": map[string]any{
			"queue":    "reports",
			"priority": 5,
		},
	})

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}

	var resp struct {
		Job MemoryJob `json:"job"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if resp.Job.Queue != "reports" {
		t.Errorf("expected queue reports, got %s", resp.Job.Queue)
	}
	if resp.Job.Priority != 5 {
		t.Errorf("expected priority 5, got %d", resp.Job.Priority)
	}
}

func TestCreateJobScheduled(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	rr := doRequest(t, r, "POST", "/jobs", map[string]any{
		"type": "cron.task",
		"args": []any{},
		"options": map[string]any{
			"scheduled_at": "2030-01-01T00:00:00Z",
		},
	})

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}

	var resp struct {
		Job MemoryJob `json:"job"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if resp.Job.State != StateScheduled {
		t.Errorf("expected state scheduled, got %s", resp.Job.State)
	}
}

func TestCreateJobMissingType(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	rr := doRequest(t, r, "POST", "/jobs", map[string]any{
		"args": []any{"test"},
	})

	if rr.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected 422, got %d", rr.Code)
	}
}

func TestGetJob(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()
	job := createJob(t, r, "email.send")

	rr := doRequest(t, r, "GET", "/jobs/"+job.ID, nil)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp struct {
		Job MemoryJob `json:"job"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if resp.Job.ID != job.ID {
		t.Errorf("expected ID %s, got %s", job.ID, resp.Job.ID)
	}
}

func TestGetJobNotFound(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	rr := doRequest(t, r, "GET", "/jobs/nonexistent", nil)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rr.Code)
	}
}

func TestCancelJob(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()
	job := createJob(t, r, "email.send")

	rr := doRequest(t, r, "DELETE", "/jobs/"+job.ID, nil)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Job MemoryJob `json:"job"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if resp.Job.State != StateCancelled {
		t.Errorf("expected state cancelled, got %s", resp.Job.State)
	}
}

func TestCancelJobTerminalState(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()
	job := createJob(t, r, "email.send")

	// Cancel once
	doRequest(t, r, "DELETE", "/jobs/"+job.ID, nil)

	// Try to cancel again — should fail
	rr := doRequest(t, r, "DELETE", "/jobs/"+job.ID, nil)

	if rr.Code != http.StatusConflict {
		t.Errorf("expected 409, got %d", rr.Code)
	}
}

func TestFetchJob(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()
	createJob(t, r, "email.send")

	rr := doRequest(t, r, "POST", "/workers/fetch", map[string]any{
		"queues": []string{"default"},
		"count":  1,
	})

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp struct {
		Jobs []MemoryJob `json:"jobs"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if len(resp.Jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(resp.Jobs))
	}
	if resp.Jobs[0].State != StateActive {
		t.Errorf("expected state active, got %s", resp.Jobs[0].State)
	}
	if resp.Jobs[0].Attempt != 1 {
		t.Errorf("expected attempt 1, got %d", resp.Jobs[0].Attempt)
	}
}

func TestFetchEmptyQueue(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	rr := doRequest(t, r, "POST", "/workers/fetch", map[string]any{
		"queues": []string{"default"},
	})

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp struct {
		Jobs []MemoryJob `json:"jobs"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if resp.Jobs == nil {
		// nil is ok — we just need it to not error
		return
	}
	if len(resp.Jobs) != 0 {
		t.Errorf("expected 0 jobs, got %d", len(resp.Jobs))
	}
}

func TestAckJob(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()
	createJob(t, r, "email.send")

	// Fetch to make active
	var fetchResp struct {
		Jobs []MemoryJob `json:"jobs"`
	}
	rr := doRequest(t, r, "POST", "/workers/fetch", map[string]any{"queues": []string{"default"}})
	json.Unmarshal(rr.Body.Bytes(), &fetchResp)

	// Ack
	rr = doRequest(t, r, "POST", "/workers/ack", map[string]any{
		"job_id": fetchResp.Jobs[0].ID,
		"result": map[string]any{"delivered": true},
	})

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Job MemoryJob `json:"job"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if resp.Job.State != StateCompleted {
		t.Errorf("expected state completed, got %s", resp.Job.State)
	}
}

func TestNackJobRetryable(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()
	createJob(t, r, "email.send")

	// Fetch
	var fetchResp struct {
		Jobs []MemoryJob `json:"jobs"`
	}
	rr := doRequest(t, r, "POST", "/workers/fetch", map[string]any{"queues": []string{"default"}})
	json.Unmarshal(rr.Body.Bytes(), &fetchResp)

	// Nack (attempt 1, max 3 — should be retryable → available)
	rr = doRequest(t, r, "POST", "/workers/nack", map[string]any{
		"job_id": fetchResp.Jobs[0].ID,
		"error":  map[string]any{"type": "transient", "message": "timeout"},
	})

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Job MemoryJob `json:"job"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	// After nack with retries remaining, job becomes available (auto-requeue)
	if resp.Job.State != StateAvailable {
		t.Errorf("expected state available (re-queued), got %s", resp.Job.State)
	}
}

func TestNackJobExhausted(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	// Create job, then fetch+nack 3 times to exhaust retries
	createJob(t, r, "email.send")

	for i := 0; i < 3; i++ {
		rr := doRequest(t, r, "POST", "/workers/fetch", map[string]any{"queues": []string{"default"}})
		var fetchResp struct {
			Jobs []MemoryJob `json:"jobs"`
		}
		json.Unmarshal(rr.Body.Bytes(), &fetchResp)
		if len(fetchResp.Jobs) == 0 {
			t.Fatalf("iteration %d: expected a job, got none", i)
		}
		doRequest(t, r, "POST", "/workers/nack", map[string]any{"job_id": fetchResp.Jobs[0].ID})
	}

	// Get job — should be discarded
	jobs := mb.ListJobs()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}
	if jobs[0].State != StateDiscarded {
		t.Errorf("expected state discarded, got %s", jobs[0].State)
	}
}

func TestPriorityOrdering(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	// Create low-priority then high-priority
	doRequest(t, r, "POST", "/jobs", map[string]any{
		"type": "low",
		"args": []any{},
		"options": map[string]any{"priority": 1},
	})
	doRequest(t, r, "POST", "/jobs", map[string]any{
		"type": "high",
		"args": []any{},
		"options": map[string]any{"priority": 10},
	})

	// Fetch should return high-priority first
	rr := doRequest(t, r, "POST", "/workers/fetch", map[string]any{
		"queues": []string{"default"},
		"count":  2,
	})

	var resp struct {
		Jobs []MemoryJob `json:"jobs"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if len(resp.Jobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(resp.Jobs))
	}
	if resp.Jobs[0].Type != "high" {
		t.Errorf("expected high-priority job first, got %s", resp.Jobs[0].Type)
	}
}

func TestListQueues(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	// Create jobs in two queues
	doRequest(t, r, "POST", "/jobs", map[string]any{"type": "a", "args": []any{}, "options": map[string]any{"queue": "email"}})
	doRequest(t, r, "POST", "/jobs", map[string]any{"type": "b", "args": []any{}, "options": map[string]any{"queue": "reports"}})

	rr := doRequest(t, r, "GET", "/queues", nil)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var resp struct {
		Queues []struct {
			Name      string `json:"name"`
			Available int    `json:"available"`
		} `json:"queues"`
	}
	json.Unmarshal(rr.Body.Bytes(), &resp)

	if len(resp.Queues) < 2 {
		t.Errorf("expected at least 2 queues, got %d", len(resp.Queues))
	}
}

func TestStateChangeCallback(t *testing.T) {
	var calls []string
	mb := NewMemoryBackend(func(job *MemoryJob, from, to string) {
		calls = append(calls, from+"→"+to)
	})
	r := mb.Router()

	createJob(t, r, "email.send")

	if len(calls) != 1 || calls[0] != "→available" {
		t.Errorf("expected callback for creation, got %v", calls)
	}
}

func TestHealth(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	rr := doRequest(t, r, "GET", "/health", nil)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}
