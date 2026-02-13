package api

import (
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// ConformanceHandler handles conformance test endpoints.
type ConformanceHandler struct {
	mu   sync.RWMutex
	runs map[string]*ConformanceRun
}

// ConformanceRun represents a conformance test run.
type ConformanceRun struct {
	ID        string    `json:"id"`
	Status    string    `json:"status"` // "running", "completed", "failed"
	Level     int       `json:"level"`
	StartedAt time.Time `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`
	Results   any       `json:"results,omitempty"`
}

// NewConformanceHandler creates a new ConformanceHandler.
func NewConformanceHandler() *ConformanceHandler {
	return &ConformanceHandler{
		runs: make(map[string]*ConformanceRun),
	}
}

// Run handles POST /api/conformance/run.
func (h *ConformanceHandler) Run(w http.ResponseWriter, r *http.Request) {
	uid, _ := uuid.NewV7()
	id := uid.String()

	run := &ConformanceRun{
		ID:        id,
		Status:    "running",
		Level:     0,
		StartedAt: time.Now(),
	}

	h.mu.Lock()
	h.runs[id] = run
	h.mu.Unlock()

	// TODO: Phase 6 will implement actual conformance test execution
	go func() {
		time.Sleep(100 * time.Millisecond)
		h.mu.Lock()
		now := time.Now()
		run.Status = "completed"
		run.EndedAt = &now
		run.Results = map[string]any{
			"total":  0,
			"passed": 0,
			"failed": 0,
			"message": "Conformance runner not yet implemented. See Phase 6.",
		}
		h.mu.Unlock()
	}()

	WriteJSON(w, http.StatusAccepted, map[string]any{"run": run})
}

// GetRun handles GET /api/conformance/run/{id}.
func (h *ConformanceHandler) GetRun(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	h.mu.RLock()
	run, ok := h.runs[id]
	h.mu.RUnlock()

	if !ok {
		WriteError(w, http.StatusNotFound, "Conformance run not found: "+id)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"run": run})
}

// GetReport handles GET /api/conformance/run/{id}/report.
func (h *ConformanceHandler) GetReport(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	h.mu.RLock()
	run, ok := h.runs[id]
	h.mu.RUnlock()

	if !ok {
		WriteError(w, http.StatusNotFound, "Conformance run not found: "+id)
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"run":    run,
		"report": run.Results,
	})
}
