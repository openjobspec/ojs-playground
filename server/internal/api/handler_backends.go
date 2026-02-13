package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/openjobspec/ojs-playground/server/internal/backends"
)

// BackendHandler handles backend-related endpoints.
type BackendHandler struct {
	manager *backends.Manager
}

// NewBackendHandler creates a new BackendHandler.
func NewBackendHandler(manager *backends.Manager) *BackendHandler {
	return &BackendHandler{manager: manager}
}

// List handles GET /api/backends.
func (h *BackendHandler) List(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]any{
		"backends": h.manager.List(),
		"active":   h.manager.ActiveName(),
	})
}

// Stats handles GET /api/backends/{name}/stats.
func (h *BackendHandler) Stats(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	b, ok := h.manager.Get(name)
	if !ok {
		WriteError(w, http.StatusNotFound, "Backend not found: "+name)
		return
	}

	stats, err := b.Stats(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "Failed to get stats: "+err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"stats": stats})
}

// Pause handles POST /api/backends/{name}/pause.
func (h *BackendHandler) Pause(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if _, ok := h.manager.Get(name); !ok {
		WriteError(w, http.StatusNotFound, "Backend not found: "+name)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"status": "paused", "backend": name})
}

// Resume handles POST /api/backends/{name}/resume.
func (h *BackendHandler) Resume(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if _, ok := h.manager.Get(name); !ok {
		WriteError(w, http.StatusNotFound, "Backend not found: "+name)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"status": "active", "backend": name})
}
