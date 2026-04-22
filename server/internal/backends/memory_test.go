package backends

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
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

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rr.Code)
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
		"type":    "low",
		"args":    []any{},
		"options": map[string]any{"priority": 1},
	})
	doRequest(t, r, "POST", "/jobs", map[string]any{
		"type":    "high",
		"args":    []any{},
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

func createJobWithPriority(t *testing.T, r chi.Router, jobType string, priority int) *MemoryJob {
	t.Helper()
	body := map[string]any{
		"type":    jobType,
		"args":    []any{"arg1"},
		"options": map[string]any{"priority": priority},
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

// TestFetchFiresStateChangeCallbacksInOrder guards the fetch handler's
// state-change notifications. Previously the callbacks were deferred inside the
// fetch loop, so they ran after the response and in reverse order; they must
// instead fire once per fetched job, in response order.
func TestFetchFiresStateChangeCallbacksInOrder(t *testing.T) {
	type change struct{ id, from, to string }
	var changes []change
	mb := NewMemoryBackend(func(job *MemoryJob, from, to string) {
		if to == StateActive {
			changes = append(changes, change{job.ID, from, to})
		}
	})
	r := mb.Router()

	// Distinct priorities make the fetch order deterministic.
	hi := createJobWithPriority(t, r, "job.hi", 10)
	lo := createJobWithPriority(t, r, "job.lo", 1)

	rr := doRequest(t, r, "POST", "/workers/fetch", map[string]any{
		"queues": []string{"default"},
		"count":  2,
	})
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp struct {
		Jobs []MemoryJob `json:"jobs"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Jobs) != 2 {
		t.Fatalf("expected 2 fetched jobs, got %d", len(resp.Jobs))
	}

	if len(changes) != 2 {
		t.Fatalf("expected 2 active callbacks, got %d: %+v", len(changes), changes)
	}
	for i, c := range changes {
		if c.from != StateAvailable || c.to != StateActive {
			t.Errorf("callback %d: expected available→active, got %s→%s", i, c.from, c.to)
		}
		if c.id != resp.Jobs[i].ID {
			t.Errorf("callback %d id %s does not match fetched job id %s (order mismatch)", i, c.id, resp.Jobs[i].ID)
		}
	}

	// Higher priority job is fetched (and notified) first.
	if resp.Jobs[0].ID != hi.ID || resp.Jobs[1].ID != lo.ID {
		t.Errorf("expected priority order [%s, %s], got [%s, %s]", hi.ID, lo.ID, resp.Jobs[0].ID, resp.Jobs[1].ID)
	}
}

func TestMemoryJobSnapshotsDoNotAliasInternalState(t *testing.T) {
	mb := NewMemoryBackend(func(job *MemoryJob, _, _ string) {
		job.Type = "callback-mutated"
		if len(job.Args) > 0 {
			job.Args[0] = 'X'
		}
		job.Tags = append(job.Tags, "callback")
	})
	r := mb.Router()

	rr := doRequest(t, r, http.MethodPost, "/jobs", map[string]any{
		"type":    "snapshot.test",
		"args":    []any{"value"},
		"meta":    map[string]any{"source": "test"},
		"options": map[string]any{"tags": []string{"original"}},
	})
	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}
	var created struct {
		Job MemoryJob `json:"job"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Job.Type != "snapshot.test" || string(created.Job.Args) != `["value"]` {
		t.Fatalf("callback mutated response snapshot: %+v", created.Job)
	}

	first, ok := mb.GetJob(created.Job.ID)
	if !ok {
		t.Fatal("job not found")
	}
	first.Type = "caller-mutated"
	first.Args[0] = 'Y'
	first.Tags[0] = "caller"

	second, _ := mb.GetJob(created.Job.ID)
	if second.Type != "snapshot.test" || string(second.Args) != `["value"]` || second.Tags[0] != "original" {
		t.Fatalf("returned job aliases internal state: %+v", second)
	}

	listed := mb.ListJobs()
	listed[0].Meta[0] = 'Z'
	again, _ := mb.GetJob(created.Job.ID)
	if string(again.Meta) != `{"source":"test"}` {
		t.Fatalf("listed job aliases internal metadata: %s", again.Meta)
	}
}

func TestMemoryBackendAcceptsExtensionsAndRejectsOversizedBodies(t *testing.T) {
	mb := newTestBackend()
	r := mb.Router()

	extension := httptest.NewRequest(http.MethodPost, "/jobs", strings.NewReader(`{"type":"test.job","args":[],"x_future":{"enabled":true}}`))
	extensionRecorder := httptest.NewRecorder()
	r.ServeHTTP(extensionRecorder, extension)
	if extensionRecorder.Code != http.StatusCreated {
		t.Fatalf("expected protocol extension to return 201, got %d: %s", extensionRecorder.Code, extensionRecorder.Body.String())
	}
	var extensionResponse struct {
		Job map[string]any `json:"job"`
	}
	if err := json.Unmarshal(extensionRecorder.Body.Bytes(), &extensionResponse); err != nil {
		t.Fatal(err)
	}
	if future, ok := extensionResponse.Job["x_future"].(map[string]any); !ok || future["enabled"] != true {
		t.Fatalf("protocol extension was not preserved: %#v", extensionResponse.Job)
	}

	oversizedBody := `{"type":"test.job","args":["` + strings.Repeat("x", 2<<20) + `"]}`
	oversized := httptest.NewRequest(http.MethodPost, "/jobs", io.NopCloser(strings.NewReader(oversizedBody)))
	oversized.ContentLength = -1
	oversized.TransferEncoding = []string{"chunked"}
	oversizedRecorder := httptest.NewRecorder()
	r.ServeHTTP(oversizedRecorder, oversized)
	if oversizedRecorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected chunked oversized body to return 413, got %d", oversizedRecorder.Code)
	}

	job := createJob(t, r, "output.test")
	fetch := doRequest(t, r, http.MethodPost, "/workers/fetch", map[string]any{"queues": []string{"default"}})
	if fetch.Code != http.StatusOK {
		t.Fatalf("fetch: %d", fetch.Code)
	}
	outputBody := `{"job_id":"` + job.ID + `","result":"` + strings.Repeat("x", (1<<20)+1) + `"}`
	output := httptest.NewRequest(http.MethodPost, "/workers/ack", strings.NewReader(outputBody))
	outputRecorder := httptest.NewRecorder()
	r.ServeHTTP(outputRecorder, output)
	if outputRecorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected oversized result to return 413, got %d", outputRecorder.Code)
	}

	trailing := httptest.NewRequest(http.MethodPost, "/jobs", strings.NewReader(`{"type":"test.job","args":[]} {}`))
	trailingRecorder := httptest.NewRecorder()
	r.ServeHTTP(trailingRecorder, trailing)
	if trailingRecorder.Code != http.StatusBadRequest {
		t.Fatalf("expected trailing JSON value to return 400, got %d", trailingRecorder.Code)
	}
}

func TestProtocolCreateAcceptsCurrentEnvelopeOptions(t *testing.T) {
	tests := []struct {
		name      string
		body      map[string]any
		assertJob func(*testing.T, map[string]any)
	}{
		{
			name: "retry",
			body: map[string]any{
				"type": "retry.test",
				"args": []any{},
				"options": map[string]any{
					"retry": map[string]any{
						"max_attempts":        5,
						"initial_interval":    "PT1S",
						"backoff_coefficient": 2,
						"x_retry_extension":   true,
					},
				},
			},
			assertJob: func(t *testing.T, job map[string]any) {
				t.Helper()
				if job["max_attempts"] != float64(5) {
					t.Fatalf("max_attempts was not retained: %#v", job)
				}
				if _, ok := job["retry"].(map[string]any); !ok {
					t.Fatalf("retry policy was not retained: %#v", job)
				}
			},
		},
		{
			name: "unique",
			body: map[string]any{
				"type": "unique.test",
				"args": []any{},
				"options": map[string]any{
					"unique": map[string]any{
						"keys":        []string{"type", "args"},
						"on_conflict": "reject",
					},
				},
			},
			assertJob: func(t *testing.T, job map[string]any) {
				t.Helper()
				if _, ok := job["unique"].(map[string]any); !ok {
					t.Fatalf("unique policy was not retained: %#v", job)
				}
			},
		},
		{
			name: "future delay_until",
			body: map[string]any{
				"type": "scheduled.test",
				"args": []any{},
				"options": map[string]any{
					"delay_until": "2099-12-31T23:59:59Z",
				},
			},
			assertJob: func(t *testing.T, job map[string]any) {
				t.Helper()
				if job["state"] != StateScheduled || job["scheduled_at"] != "2099-12-31T23:59:59Z" {
					t.Fatalf("future job was not scheduled: %#v", job)
				}
			},
		},
		{
			name: "past delay_until",
			body: map[string]any{
				"type": "immediate.test",
				"args": []any{},
				"options": map[string]any{
					"delay_until": "2020-01-01T00:00:00Z",
				},
			},
			assertJob: func(t *testing.T, job map[string]any) {
				t.Helper()
				if job["state"] != StateAvailable {
					t.Fatalf("past scheduled job should be available: %#v", job)
				}
			},
		},
		{
			name: "priority idempotency and extensions",
			body: map[string]any{
				"type":            "extension.test",
				"args":            []any{},
				"idempotency_key": "request-123",
				"x_trace":         map[string]any{"sampled": true},
				"options": map[string]any{
					"priority":       10,
					"x_backend_hint": "future",
				},
			},
			assertJob: func(t *testing.T, job map[string]any) {
				t.Helper()
				if job["priority"] != float64(10) || job["idempotency_key"] != "request-123" {
					t.Fatalf("priority or idempotency extension was not accepted: %#v", job)
				}
				trace, ok := job["x_trace"].(map[string]any)
				if !ok || trace["sampled"] != true {
					t.Fatalf("top-level extension was not preserved: %#v", job)
				}
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			rr := doRequest(t, newTestBackend().Router(), http.MethodPost, "/jobs", test.body)
			if rr.Code != http.StatusCreated {
				t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
			}
			var response struct {
				Job map[string]any `json:"job"`
			}
			if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			test.assertJob(t, response.Job)
		})
	}
}

func TestProtocolWorkerRequestsTolerateUnknownExtensions(t *testing.T) {
	backend := newTestBackend()
	router := backend.Router()
	first := createJob(t, router, "extension.ack")

	fetch := doRequest(t, router, http.MethodPost, "/workers/fetch", map[string]any{
		"queues":                []string{"default"},
		"worker_id":             "worker-1",
		"visibility_timeout_ms": 30_000,
		"x_fetch_extension":     true,
	})
	if fetch.Code != http.StatusOK {
		t.Fatalf("fetch extension: expected 200, got %d: %s", fetch.Code, fetch.Body.String())
	}

	ack := doRequest(t, router, http.MethodPost, "/workers/ack", map[string]any{
		"job_id":          first.ID,
		"worker_id":       "worker-1",
		"x_ack_extension": true,
	})
	if ack.Code != http.StatusOK {
		t.Fatalf("ack extension: expected 200, got %d: %s", ack.Code, ack.Body.String())
	}

	second := createJob(t, router, "extension.nack")
	fetch = doRequest(t, router, http.MethodPost, "/workers/fetch", map[string]any{
		"queues":    []string{"default"},
		"worker_id": "worker-2",
	})
	if fetch.Code != http.StatusOK {
		t.Fatalf("second fetch: expected 200, got %d: %s", fetch.Code, fetch.Body.String())
	}
	nack := doRequest(t, router, http.MethodPost, "/workers/nack", map[string]any{
		"job_id":           second.ID,
		"worker_id":        "worker-2",
		"error":            map[string]any{"code": "handler_error", "message": "retry", "retryable": true},
		"x_nack_extension": true,
	})
	if nack.Code != http.StatusOK {
		t.Fatalf("nack extension: expected 200, got %d: %s", nack.Code, nack.Body.String())
	}
}

func TestConcurrentFetchAckAndListUsesSnapshots(t *testing.T) {
	mb := NewMemoryBackend(func(job *MemoryJob, _, _ string) {
		job.Type = "callback-copy"
		if len(job.Args) > 0 {
			job.Args[0] ^= 0xff
		}
	})
	r := mb.Router()
	for i := 0; i < 80; i++ {
		createJob(t, r, "race.test")
	}

	var wg sync.WaitGroup
	errs := make(chan string, 16)
	for worker := 0; worker < 4; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				rr := doRequest(t, r, http.MethodPost, "/workers/fetch", map[string]any{
					"queues": []string{"default"},
					"count":  1,
				})
				if rr.Code != http.StatusOK {
					errs <- rr.Body.String()
					return
				}
				var fetched struct {
					Jobs []MemoryJob `json:"jobs"`
				}
				if err := json.Unmarshal(rr.Body.Bytes(), &fetched); err != nil {
					errs <- err.Error()
					return
				}
				if len(fetched.Jobs) == 0 {
					return
				}
				ack := doRequest(t, r, http.MethodPost, "/workers/ack", map[string]any{
					"job_id": fetched.Jobs[0].ID,
					"result": map[string]any{"ok": true},
				})
				if ack.Code != http.StatusOK {
					errs <- ack.Body.String()
					return
				}
			}
		}()
	}
	for reader := 0; reader < 4; reader++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 500; i++ {
				jobs := mb.ListJobs()
				for _, job := range jobs {
					job.State = "reader-mutated"
					if len(job.Args) > 0 {
						job.Args[0] = 'R'
					}
					if snapshot, ok := mb.GetJob(job.ID); ok && snapshot.State == "reader-mutated" {
						errs <- "reader mutation reached internal state"
						return
					}
				}
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
}
