package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/openjobspec/ojs-playground/server/internal/discovery"
)

// WorkerHandler handles worker discovery endpoints.
type WorkerHandler struct {
	registry *discovery.Registry
}

// NewWorkerHandler creates a new WorkerHandler.
func NewWorkerHandler(registry *discovery.Registry) *WorkerHandler {
	return &WorkerHandler{registry: registry}
}

// List handles GET /api/workers.
func (h *WorkerHandler) List(w http.ResponseWriter, r *http.Request) {
	workers := h.registry.List()
	if workers == nil {
		workers = []*discovery.DiscoveredWorker{}
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"workers":   workers,
		"connected": h.registry.Connected(),
		"total":     h.registry.Count(),
	})
}

// Register handles POST /api/workers — manual worker registration.
func (h *WorkerHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string   `json:"name"`
		URL      string   `json:"url"`
		Port     int      `json:"port,omitempty"`
		Queues   []string `json:"queues,omitempty"`
		JobTypes []string `json:"job_types,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		WriteError(w, http.StatusBadRequest, "Invalid JSON: "+err.Error())
		return
	}

	if req.URL == "" {
		WriteError(w, http.StatusUnprocessableEntity, "Field 'url' is required.")
		return
	}

	worker := &discovery.DiscoveredWorker{
		ID:       fmt.Sprintf("manual-%s-%d", req.Name, req.Port),
		Name:     req.Name,
		URL:      req.URL,
		Port:     req.Port,
		Queues:   req.Queues,
		JobTypes: req.JobTypes,
	}

	h.registry.Register(worker)
	WriteJSON(w, http.StatusCreated, map[string]any{"worker": worker})
}

// Delete handles DELETE /api/workers/{id}.
func (h *WorkerHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if _, ok := h.registry.Get(id); !ok {
		WriteError(w, http.StatusNotFound, "Worker not found: "+id)
		return
	}

	h.registry.Unregister(id)
	WriteJSON(w, http.StatusOK, map[string]any{"status": "removed", "worker_id": id})
}

// Drain handles POST /api/workers/{id}/drain.
func (h *WorkerHandler) Drain(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	worker, ok := h.registry.Get(id)
	if !ok {
		WriteError(w, http.StatusNotFound, "Worker not found: "+id)
		return
	}

	// Mark as draining (disconnected)
	h.registry.MarkDisconnected(id)
	WriteJSON(w, http.StatusOK, map[string]any{"status": "draining", "worker": worker})
}
