package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/openjobspec/ojs-playground/server/internal/conformance"
)

type fakeConformanceRunner struct {
	count   int
	started chan context.Context
	release chan struct{}
	once    sync.Once
}

func (f *fakeConformanceRunner) TestCount(int) int { return f.count }

func (f *fakeConformanceRunner) Run(ctx context.Context, id string, level int) *conformance.RunResult {
	if f.started != nil {
		f.started <- ctx
	}
	startedAt := time.Now()
	status := "completed"
	if f.release != nil {
		select {
		case <-f.release:
		case <-ctx.Done():
			status = "cancelled"
		}
	}
	endedAt := time.Now()
	return &conformance.RunResult{
		ID:        id,
		Level:     level,
		Status:    status,
		StartedAt: startedAt,
		EndedAt:   &endedAt,
		Total:     1,
		Passed:    1,
	}
}

func (f *fakeConformanceRunner) unblock() {
	if f.release != nil {
		f.once.Do(func() { close(f.release) })
	}
}

func TestConformanceUnavailableReturnsServiceUnavailable(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	handler := NewConformanceHandler(ctx, nil, ConformanceHandlerOptions{CleanupInterval: time.Hour})

	recorder := httptest.NewRecorder()
	handler.Run(recorder, httptest.NewRequest(http.MethodPost, "/api/conformance/run", nil))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestConformanceRunOutlivesRequestContext(t *testing.T) {
	appCtx, cancelApp := context.WithCancel(context.Background())
	defer cancelApp()
	runner := &fakeConformanceRunner{
		count:   1,
		started: make(chan context.Context, 1),
		release: make(chan struct{}),
	}
	handler := NewConformanceHandler(appCtx, runner, ConformanceHandlerOptions{CleanupInterval: time.Hour})

	requestCtx, cancelRequest := context.WithCancel(context.Background())
	request := httptest.NewRequest(http.MethodPost, "/api/conformance/run", nil).WithContext(requestCtx)
	recorder := httptest.NewRecorder()
	handler.Run(recorder, request)
	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d: %s", recorder.Code, recorder.Body.String())
	}
	runID := decodeRunID(t, recorder)
	runCtx := <-runner.started
	cancelRequest()

	select {
	case <-runCtx.Done():
		t.Fatal("background run inherited the completed request context")
	case <-time.After(20 * time.Millisecond):
	}
	runner.unblock()
	waitForRunStatus(t, handler, runID, "completed")
}

func TestConformanceConcurrentRunLimit(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runner := &fakeConformanceRunner{count: 1, started: make(chan context.Context, 1), release: make(chan struct{})}
	handler := NewConformanceHandler(ctx, runner, ConformanceHandlerOptions{
		MaxConcurrent:   1,
		CleanupInterval: time.Hour,
	})

	first := httptest.NewRecorder()
	handler.Run(first, httptest.NewRequest(http.MethodPost, "/api/conformance/run", nil))
	if first.Code != http.StatusAccepted {
		t.Fatalf("expected first run to start, got %d", first.Code)
	}
	<-runner.started

	second := httptest.NewRecorder()
	handler.Run(second, httptest.NewRequest(http.MethodPost, "/api/conformance/run", nil))
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", second.Code)
	}
	runner.unblock()
	waitForRunStatus(t, handler, decodeRunID(t, first), "completed")
}

func TestConformanceCancellationAndRetention(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runner := &fakeConformanceRunner{count: 1, started: make(chan context.Context, 1), release: make(chan struct{})}
	handler := NewConformanceHandler(ctx, runner, ConformanceHandlerOptions{
		MaxConcurrent:   1,
		MaxRuns:         2,
		RetentionTTL:    time.Minute,
		CleanupInterval: time.Hour,
	})

	start := httptest.NewRecorder()
	handler.Run(start, httptest.NewRequest(http.MethodPost, "/api/conformance/run", nil))
	runID := decodeRunID(t, start)
	<-runner.started

	router := chi.NewRouter()
	router.Delete("/api/conformance/run/{id}", handler.CancelRun)
	cancelRecorder := httptest.NewRecorder()
	router.ServeHTTP(cancelRecorder, httptest.NewRequest(http.MethodDelete, "/api/conformance/run/"+runID, nil))
	if cancelRecorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202 cancellation, got %d", cancelRecorder.Code)
	}
	waitForRunStatus(t, handler, runID, "cancelled")

	now := time.Now()
	handler.mu.Lock()
	handler.now = func() time.Time { return now.Add(2 * time.Minute) }
	handler.cleanupLocked()
	_, retained := handler.runs[runID]
	handler.mu.Unlock()
	if retained {
		t.Fatal("expired conformance run was not removed")
	}
}

func TestConformanceRetentionBoundsRunCount(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	runner := &fakeConformanceRunner{count: 1}
	handler := NewConformanceHandler(ctx, runner, ConformanceHandlerOptions{
		MaxConcurrent:   1,
		MaxRuns:         2,
		RetentionTTL:    time.Hour,
		CleanupInterval: time.Hour,
	})

	for i := 0; i < 3; i++ {
		recorder := httptest.NewRecorder()
		handler.Run(recorder, httptest.NewRequest(http.MethodPost, "/api/conformance/run", nil))
		if recorder.Code != http.StatusAccepted {
			t.Fatalf("run %d: expected 202, got %d", i, recorder.Code)
		}
		waitForRunStatus(t, handler, decodeRunID(t, recorder), "completed")
	}

	handler.mu.Lock()
	count := len(handler.runs)
	handler.mu.Unlock()
	if count != 2 {
		t.Fatalf("expected at most 2 retained runs, got %d", count)
	}
}

func decodeRunID(t *testing.T, recorder *httptest.ResponseRecorder) string {
	t.Helper()
	var response struct {
		Run ConformanceRun `json:"run"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Run.ID == "" {
		t.Fatal("response did not contain a run ID")
	}
	return response.Run.ID
}

func waitForRunStatus(t *testing.T, handler *ConformanceHandler, id, want string) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		handler.mu.Lock()
		run := cloneConformanceRun(handler.runs[id])
		handler.mu.Unlock()
		if run != nil && run.Status == want {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("run %s did not reach status %s", id, want)
}
