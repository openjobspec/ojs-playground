package api

import (
	"context"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/openjobspec/ojs-playground/server/internal/conformance"
	"github.com/openjobspec/ojs-playground/server/internal/httpjson"
)

type conformanceRunner interface {
	Run(ctx context.Context, runID string, level int) *conformance.RunResult
	TestCount(level int) int
}

// ConformanceHandlerOptions bounds background work and retained results.
type ConformanceHandlerOptions struct {
	MaxConcurrent   int
	MaxRuns         int
	RetentionTTL    time.Duration
	CleanupInterval time.Duration
}

func defaultConformanceHandlerOptions() ConformanceHandlerOptions {
	return ConformanceHandlerOptions{
		MaxConcurrent:   2,
		MaxRuns:         100,
		RetentionTTL:    time.Hour,
		CleanupInterval: 5 * time.Minute,
	}
}

// ConformanceHandler handles conformance test endpoints.
type ConformanceHandler struct {
	ctx     context.Context
	mu      sync.Mutex
	runs    map[string]*ConformanceRun
	runner  conformanceRunner
	running int
	options ConformanceHandlerOptions
	now     func() time.Time
}

// ConformanceRun represents a conformance test run.
type ConformanceRun struct {
	ID        string                 `json:"id"`
	Status    string                 `json:"status"`
	Level     int                    `json:"level"`
	StartedAt time.Time              `json:"started_at"`
	EndedAt   *time.Time             `json:"ended_at,omitempty"`
	Results   *conformance.RunResult `json:"results,omitempty"`
	cancel    context.CancelFunc
}

// NewConformanceHandler creates a bounded handler tied to the application context.
func NewConformanceHandler(
	ctx context.Context,
	runner conformanceRunner,
	options ConformanceHandlerOptions,
) *ConformanceHandler {
	defaults := defaultConformanceHandlerOptions()
	if ctx == nil {
		ctx = context.Background()
	}
	if options.MaxConcurrent <= 0 {
		options.MaxConcurrent = defaults.MaxConcurrent
	}
	if options.MaxRuns <= 0 {
		options.MaxRuns = defaults.MaxRuns
	}
	if options.RetentionTTL <= 0 {
		options.RetentionTTL = defaults.RetentionTTL
	}
	if options.CleanupInterval <= 0 {
		options.CleanupInterval = defaults.CleanupInterval
	}

	handler := &ConformanceHandler{
		ctx:     ctx,
		runs:    make(map[string]*ConformanceRun),
		runner:  runner,
		options: options,
		now:     time.Now,
	}
	go handler.cleanupLoop()
	return handler
}

type conformanceRunRequest struct {
	Level int `json:"level"`
}

// Run handles POST /api/conformance/run.
func (h *ConformanceHandler) Run(w http.ResponseWriter, r *http.Request) {
	var request conformanceRunRequest
	if decodeErr := httpjson.Decode(w, r, &request, 4<<10, true); decodeErr != nil {
		WriteError(w, decodeErr.Status, decodeErr.Message)
		return
	}
	if request.Level < 0 || request.Level > 4 {
		WriteError(w, http.StatusBadRequest, "Conformance level must be between 0 and 4.")
		return
	}
	if h.runner == nil || h.runner.TestCount(request.Level) == 0 {
		WriteError(w, http.StatusServiceUnavailable, "Conformance suites are unavailable for the requested level.")
		return
	}

	h.mu.Lock()
	h.cleanupLocked()
	if h.running >= h.options.MaxConcurrent {
		h.mu.Unlock()
		WriteError(w, http.StatusTooManyRequests, "Too many conformance runs are already active.")
		return
	}
	h.enforceMaxRunsLocked(h.options.MaxRuns - 1)
	if len(h.runs) >= h.options.MaxRuns {
		h.mu.Unlock()
		WriteError(w, http.StatusTooManyRequests, "Conformance run retention is full.")
		return
	}

	uid, err := uuid.NewV7()
	if err != nil {
		h.mu.Unlock()
		WriteError(w, http.StatusInternalServerError, "Failed to allocate a conformance run ID.")
		return
	}
	id := uid.String()
	runContext, cancel := context.WithCancel(h.ctx)
	run := &ConformanceRun{
		ID:        id,
		Status:    "running",
		Level:     request.Level,
		StartedAt: h.now(),
		cancel:    cancel,
	}
	h.runs[id] = run
	h.running++
	snapshot := cloneConformanceRun(run)
	h.mu.Unlock()

	go h.execute(runContext, id, request.Level)
	WriteJSON(w, http.StatusAccepted, map[string]any{"run": snapshot})
}

func (h *ConformanceHandler) execute(ctx context.Context, id string, level int) {
	result := h.runner.Run(ctx, id, level)
	h.mu.Lock()
	defer h.mu.Unlock()

	run, ok := h.runs[id]
	if !ok {
		return
	}
	run.Status = result.Status
	run.EndedAt = cloneTime(result.EndedAt)
	run.Results = cloneRunResult(result)
	run.cancel = nil
	if h.running > 0 {
		h.running--
	}
	h.cleanupLocked()
}

// CancelRun handles DELETE /api/conformance/run/{id}.
func (h *ConformanceHandler) CancelRun(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	h.mu.Lock()
	h.cleanupLocked()
	run, ok := h.runs[id]
	if !ok {
		h.mu.Unlock()
		WriteError(w, http.StatusNotFound, "Conformance run not found: "+id)
		return
	}
	cancel := run.cancel
	snapshot := cloneConformanceRun(run)
	h.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	WriteJSON(w, http.StatusAccepted, map[string]any{"run": snapshot})
}

// GetRun handles GET /api/conformance/run/{id}.
func (h *ConformanceHandler) GetRun(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	h.mu.Lock()
	h.cleanupLocked()
	run, ok := h.runs[id]
	snapshot := cloneConformanceRun(run)
	h.mu.Unlock()

	if !ok {
		WriteError(w, http.StatusNotFound, "Conformance run not found: "+id)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"run": snapshot})
}

// GetReport handles GET /api/conformance/run/{id}/report.
func (h *ConformanceHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	h.mu.Lock()
	h.cleanupLocked()
	run, ok := h.runs[id]
	snapshot := cloneConformanceRun(run)
	h.mu.Unlock()

	if !ok {
		WriteError(w, http.StatusNotFound, "Conformance run not found: "+id)
		return
	}
	if snapshot.Results == nil {
		WriteJSON(w, http.StatusOK, map[string]any{"run": snapshot, "report": nil})
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"run":    snapshot,
		"report": conformance.GenerateReport(snapshot.Results),
	})
}

func (h *ConformanceHandler) cleanupLoop() {
	ticker := time.NewTicker(h.options.CleanupInterval)
	defer ticker.Stop()
	for {
		select {
		case <-h.ctx.Done():
			return
		case <-ticker.C:
			h.mu.Lock()
			h.cleanupLocked()
			h.mu.Unlock()
		}
	}
}

func (h *ConformanceHandler) cleanupLocked() {
	cutoff := h.now().Add(-h.options.RetentionTTL)
	for id, run := range h.runs {
		if run.Status != "running" && run.EndedAt != nil && run.EndedAt.Before(cutoff) {
			delete(h.runs, id)
		}
	}
	h.enforceMaxRunsLocked(h.options.MaxRuns)
}

func (h *ConformanceHandler) enforceMaxRunsLocked(max int) {
	if max < 0 {
		max = 0
	}
	if len(h.runs) <= max {
		return
	}
	completed := make([]*ConformanceRun, 0, len(h.runs))
	for _, run := range h.runs {
		if run.Status != "running" {
			completed = append(completed, run)
		}
	}
	sort.Slice(completed, func(i, j int) bool {
		return completed[i].StartedAt.Before(completed[j].StartedAt)
	})
	for _, run := range completed {
		if len(h.runs) <= max {
			break
		}
		delete(h.runs, run.ID)
	}
}

func cloneConformanceRun(run *ConformanceRun) *ConformanceRun {
	if run == nil {
		return nil
	}
	clone := *run
	clone.EndedAt = cloneTime(run.EndedAt)
	clone.Results = cloneRunResult(run.Results)
	clone.cancel = nil
	return &clone
}

func cloneRunResult(result *conformance.RunResult) *conformance.RunResult {
	if result == nil {
		return nil
	}
	clone := *result
	clone.EndedAt = cloneTime(result.EndedAt)
	clone.Tests = append([]conformance.TestResult(nil), result.Tests...)
	return &clone
}

func cloneTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}
