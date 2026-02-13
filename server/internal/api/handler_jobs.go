package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/openjobspec/ojs-playground/server/internal/backends"
	"github.com/openjobspec/ojs-playground/server/internal/history"
	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

// JobHandler handles playground job endpoints.
type JobHandler struct {
	store       history.Store
	memory      *backends.MemoryBackend
	broadcaster *sse.Broadcaster
	backendName string
}

// NewJobHandler creates a new JobHandler.
func NewJobHandler(store history.Store, memory *backends.MemoryBackend, broadcaster *sse.Broadcaster, backendName string) *JobHandler {
	return &JobHandler{
		store:       store,
		memory:      memory,
		broadcaster: broadcaster,
		backendName: backendName,
	}
}

// Create handles POST /api/jobs — submit a job via playground API.
func (h *JobHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Type    string          `json:"type"`
		Args    json.RawMessage `json:"args,omitempty"`
		Queue   string          `json:"queue,omitempty"`
		Options json.RawMessage `json:"options,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	if req.Type == "" {
		WriteError(w, http.StatusUnprocessableEntity, "Field 'type' is required.")
		return
	}

	if req.Args == nil {
		req.Args = json.RawMessage(`[]`)
	}
	if req.Queue == "" {
		req.Queue = "default"
	}

	uid, _ := uuid.NewV7()
	id := uid.String()
	now := time.Now()

	// Save to history store
	job := &history.Job{
		ID:          id,
		Type:        req.Type,
		State:       "available",
		Queue:       req.Queue,
		Args:        req.Args,
		Priority:    0,
		Attempt:     0,
		MaxAttempts: 3,
		CreatedAt:   now,
		UpdatedAt:   now,
		Backend:     h.backendName,
	}

	if h.store != nil {
		if err := h.store.SaveJob(r.Context(), job); err != nil {
			WriteError(w, http.StatusInternalServerError, "Failed to save job: "+err.Error())
			return
		}
	}

	// Broadcast SSE event
	if h.broadcaster != nil {
		h.broadcaster.Broadcast(sse.Event{
			Type:      sse.EventJobStateChanged,
			Timestamp: now,
			JobID:     id,
			Queue:     req.Queue,
			Data: map[string]any{
				"job_id": id,
				"type":   req.Type,
				"state":  "available",
				"queue":  req.Queue,
			},
		})
	}

	WriteJSON(w, http.StatusCreated, map[string]any{"job": job})
}

// List handles GET /api/jobs.
func (h *JobHandler) List(w http.ResponseWriter, r *http.Request) {
	filter := history.ListFilter{
		State: r.URL.Query().Get("state"),
		Type:  r.URL.Query().Get("type"),
		Queue: r.URL.Query().Get("queue"),
	}

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		filter.Limit, _ = strconv.Atoi(limitStr)
	}
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		filter.Offset, _ = strconv.Atoi(offsetStr)
	}

	if h.store == nil {
		WriteJSON(w, http.StatusOK, map[string]any{"jobs": []any{}, "total": 0})
		return
	}

	jobs, total, err := h.store.ListJobs(r.Context(), filter)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "Failed to list jobs: "+err.Error())
		return
	}

	if jobs == nil {
		jobs = []*history.Job{}
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"jobs":  jobs,
		"total": total,
	})
}

// Get handles GET /api/jobs/{id}.
func (h *JobHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if h.store == nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}

	job, err := h.store.GetJob(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}

	stateHistory, _ := h.store.GetJobHistory(r.Context(), id)
	if stateHistory == nil {
		stateHistory = []history.StateChange{}
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"job":           job,
		"state_history": stateHistory,
	})
}

// Cancel handles DELETE /api/jobs/{id}.
func (h *JobHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if h.store == nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}

	job, err := h.store.GetJob(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}

	fromState := job.State
	if err := h.store.UpdateJobState(r.Context(), id, fromState, "cancelled", "Cancelled via playground"); err != nil {
		WriteError(w, http.StatusInternalServerError, "Failed to cancel: "+err.Error())
		return
	}

	if h.broadcaster != nil {
		h.broadcaster.Broadcast(sse.Event{
			Type:      sse.EventJobStateChanged,
			Timestamp: time.Now(),
			JobID:     id,
			Queue:     job.Queue,
			Data: map[string]any{
				"job_id":     id,
				"from_state": fromState,
				"to_state":   "cancelled",
			},
		})
	}

	job.State = "cancelled"
	WriteJSON(w, http.StatusOK, map[string]any{"job": job})
}

// Retry handles POST /api/jobs/{id}/retry.
func (h *JobHandler) Retry(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if h.store == nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}

	job, err := h.store.GetJob(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}

	fromState := job.State
	if err := h.store.UpdateJobState(r.Context(), id, fromState, "available", "Retried via playground"); err != nil {
		WriteError(w, http.StatusInternalServerError, "Failed to retry: "+err.Error())
		return
	}

	if h.broadcaster != nil {
		h.broadcaster.Broadcast(sse.Event{
			Type:      sse.EventJobStateChanged,
			Timestamp: time.Now(),
			JobID:     id,
			Queue:     job.Queue,
			Data: map[string]any{
				"job_id":     id,
				"from_state": fromState,
				"to_state":   "available",
			},
		})
	}

	job.State = "available"
	WriteJSON(w, http.StatusOK, map[string]any{"job": job})
}
