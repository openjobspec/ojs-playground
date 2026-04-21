package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/openjobspec/ojs-playground/server/internal/backends"
	"github.com/openjobspec/ojs-playground/server/internal/history"
	"github.com/openjobspec/ojs-playground/server/internal/httpjson"
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

	if decodeErr := httpjson.Decode(w, r, &req, httpjson.MaxAPIRequestBytes, false); decodeErr != nil {
		WriteError(w, decodeErr.Status, decodeErr.Message)
		return
	}

	if req.Type == "" {
		WriteError(w, http.StatusBadRequest, "Field 'type' is required.")
		return
	}
	if len(req.Type) > httpjson.MaxTypeLength {
		WriteError(w, http.StatusRequestEntityTooLarge, "Field 'type' is too large.")
		return
	}

	if req.Args == nil {
		req.Args = json.RawMessage(`[]`)
	}
	if _, decodeErr := httpjson.RequireJSONArray("args", req.Args, httpjson.MaxArgsBytes, 1000); decodeErr != nil {
		WriteError(w, decodeErr.Status, decodeErr.Message)
		return
	}
	if req.Queue == "" {
		req.Queue = "default"
	}
	if len(req.Queue) > httpjson.MaxQueueLength {
		WriteError(w, http.StatusRequestEntityTooLarge, "Field 'queue' is too large.")
		return
	}
	if req.Options != nil {
		if _, decodeErr := httpjson.RequireJSONObject("options", req.Options, httpjson.MaxMetaBytes, 1000, false); decodeErr != nil {
			WriteError(w, decodeErr.Status, decodeErr.Message)
			return
		}
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
	if len(r.URL.Query().Get("state")) > 32 ||
		len(r.URL.Query().Get("type")) > httpjson.MaxTypeLength ||
		len(r.URL.Query().Get("queue")) > httpjson.MaxQueueLength {
		WriteError(w, http.StatusRequestEntityTooLarge, "A job filter is too large.")
		return
	}
	filter := history.ListFilter{
		State: r.URL.Query().Get("state"),
		Type:  r.URL.Query().Get("type"),
		Queue: r.URL.Query().Get("queue"),
	}

	limit, offset, paginationErr := parsePagination(r, 50, httpjson.MaxListLimit)
	if paginationErr != nil {
		WriteError(w, paginationErr.Status, paginationErr.Message)
		return
	}
	filter.Limit = limit
	filter.Offset = offset

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

// GetHistory handles GET /api/jobs/{id}/history.
func (h *JobHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if len(id) == 0 || len(id) > httpjson.MaxWorkerIDLength {
		WriteError(w, http.StatusBadRequest, "Job ID is invalid.")
		return
	}
	if h.store == nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}
	if _, err := h.store.GetJob(r.Context(), id); err != nil {
		WriteError(w, http.StatusNotFound, "Job not found: "+id)
		return
	}

	limit, offset, paginationErr := parsePagination(r, 100, httpjson.MaxHistoryLimit)
	if paginationErr != nil {
		WriteError(w, paginationErr.Status, paginationErr.Message)
		return
	}
	stateHistory, err := h.store.GetJobHistory(r.Context(), id)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "Failed to load job history: "+err.Error())
		return
	}
	total := len(stateHistory)
	if offset > total {
		offset = total
	}
	end := offset + limit
	if end > total {
		end = total
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"history": stateHistory[offset:end],
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// Get handles GET /api/jobs/{id}.
func (h *JobHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if len(id) == 0 || len(id) > httpjson.MaxWorkerIDLength {
		WriteError(w, http.StatusBadRequest, "Job ID is invalid.")
		return
	}

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
	} else if len(stateHistory) > httpjson.MaxHistoryLimit {
		stateHistory = stateHistory[len(stateHistory)-httpjson.MaxHistoryLimit:]
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"job":           job,
		"state_history": stateHistory,
	})
}

// Cancel handles DELETE /api/jobs/{id}.
func (h *JobHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if len(id) == 0 || len(id) > httpjson.MaxWorkerIDLength {
		WriteError(w, http.StatusBadRequest, "Job ID is invalid.")
		return
	}

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
	if len(id) == 0 || len(id) > httpjson.MaxWorkerIDLength {
		WriteError(w, http.StatusBadRequest, "Job ID is invalid.")
		return
	}

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
