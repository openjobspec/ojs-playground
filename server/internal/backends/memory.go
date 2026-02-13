package backends

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Job states as defined by the OJS specification.
const (
	StateAvailable = "available"
	StateScheduled = "scheduled"
	StatePending   = "pending"
	StateActive    = "active"
	StateRetryable = "retryable"
	StateCompleted = "completed"
	StateCancelled = "cancelled"
	StateDiscarded = "discarded"
)

var validTransitions = map[string][]string{
	StateAvailable: {StateActive, StateCancelled},
	StateScheduled: {StateAvailable, StateCancelled},
	StatePending:   {StateAvailable, StateCancelled},
	StateActive:    {StateCompleted, StateRetryable, StateDiscarded, StateCancelled},
	StateRetryable: {StateAvailable, StateCancelled},
	StateCompleted: {},
	StateCancelled: {},
	StateDiscarded: {},
}

func isValidTransition(from, to string) bool {
	targets, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, t := range targets {
		if t == to {
			return true
		}
	}
	return false
}

func isTerminalState(state string) bool {
	return state == StateCompleted || state == StateCancelled || state == StateDiscarded
}

// MemoryJob is the in-memory representation of a job.
type MemoryJob struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	State       string          `json:"state"`
	Queue       string          `json:"queue"`
	Args        json.RawMessage `json:"args"`
	Meta        json.RawMessage `json:"meta,omitempty"`
	Priority    int             `json:"priority"`
	Attempt     int             `json:"attempt"`
	MaxAttempts int             `json:"max_attempts"`
	TimeoutMs   *int            `json:"timeout_ms,omitempty"`
	CreatedAt   string          `json:"created_at"`
	EnqueuedAt  string          `json:"enqueued_at,omitempty"`
	StartedAt   string          `json:"started_at,omitempty"`
	CompletedAt string          `json:"completed_at,omitempty"`
	CancelledAt string          `json:"cancelled_at,omitempty"`
	ScheduledAt string          `json:"scheduled_at,omitempty"`
	Result      json.RawMessage `json:"result,omitempty"`
	Error       json.RawMessage `json:"error,omitempty"`
	Tags        []string        `json:"tags,omitempty"`
}

// StateChangeCallback is called when a job state changes.
type StateChangeCallback func(job *MemoryJob, fromState, toState string)

// MemoryBackend implements a full Level 0 OJS backend in memory.
type MemoryBackend struct {
	mu              sync.RWMutex
	jobs            map[string]*MemoryJob
	queues          map[string][]*MemoryJob // queue name → available jobs (sorted by priority)
	onStateChange   StateChangeCallback
}

// NewMemoryBackend creates a new in-memory backend.
func NewMemoryBackend(onStateChange StateChangeCallback) *MemoryBackend {
	return &MemoryBackend{
		jobs:          make(map[string]*MemoryJob),
		queues:        make(map[string][]*MemoryJob),
		onStateChange: onStateChange,
	}
}

// Name returns the backend name.
func (m *MemoryBackend) Name() string { return "memory" }

// Type returns "memory".
func (m *MemoryBackend) Type() string { return "memory" }

// URL returns empty since it's in-process.
func (m *MemoryBackend) URL() string { return "" }

// Health always returns ok.
func (m *MemoryBackend) Health(ctx context.Context) (*HealthStatus, error) {
	return &HealthStatus{Status: "ok"}, nil
}

// Stats returns basic statistics.
func (m *MemoryBackend) Stats(ctx context.Context) (*BackendStats, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := &BackendStats{
		TotalJobs:   len(m.jobs),
		QueueDepths: make(map[string]int),
	}

	for _, j := range m.jobs {
		if j.State == StateActive {
			stats.ActiveJobs++
		}
	}

	for q, jobs := range m.queues {
		stats.QueueDepths[q] = len(jobs)
	}

	return stats, nil
}

// Close is a no-op for in-memory backend.
func (m *MemoryBackend) Close() error { return nil }

// Router returns a chi router implementing OJS HTTP endpoints.
// Routes are relative (no /ojs/v1 prefix) — mount at /ojs/v1.
func (m *MemoryBackend) Router() chi.Router {
	r := chi.NewRouter()

	r.Get("/health", m.handleHealth)
	r.Post("/jobs", m.handleCreateJob)
	r.Get("/jobs/{id}", m.handleGetJob)
	r.Delete("/jobs/{id}", m.handleCancelJob)
	r.Post("/workers/fetch", m.handleFetch)
	r.Post("/workers/ack", m.handleAck)
	r.Post("/workers/nack", m.handleNack)
	r.Get("/queues", m.handleListQueues)

	return r
}

func nowFormatted() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/openjobspec+json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]any{"code": code, "message": message},
	})
}

func (m *MemoryBackend) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"backend": "memory",
	})
}

func (m *MemoryBackend) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID      string          `json:"id,omitempty"`
		Type    string          `json:"type"`
		Args    json.RawMessage `json:"args"`
		Meta    json.RawMessage `json:"meta,omitempty"`
		Options *struct {
			Queue       string `json:"queue,omitempty"`
			Priority    *int   `json:"priority,omitempty"`
			TimeoutMs   *int   `json:"timeout_ms,omitempty"`
			ScheduledAt string `json:"scheduled_at,omitempty"`
			Tags        []string `json:"tags,omitempty"`
		} `json:"options,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON: "+err.Error())
		return
	}

	if req.Type == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation_error", "Field 'type' is required.")
		return
	}

	if req.Args == nil {
		req.Args = json.RawMessage(`[]`)
	}

	id := req.ID
	if id == "" {
		uid, _ := uuid.NewV7()
		id = uid.String()
	}

	now := nowFormatted()
	job := &MemoryJob{
		ID:          id,
		Type:        req.Type,
		State:       StateAvailable,
		Queue:       "default",
		Args:        req.Args,
		Meta:        req.Meta,
		Priority:    0,
		Attempt:     0,
		MaxAttempts: 3,
		CreatedAt:   now,
		EnqueuedAt:  now,
	}

	if req.Options != nil {
		if req.Options.Queue != "" {
			job.Queue = req.Options.Queue
		}
		if req.Options.Priority != nil {
			job.Priority = *req.Options.Priority
		}
		if req.Options.TimeoutMs != nil {
			job.TimeoutMs = req.Options.TimeoutMs
		}
		if req.Options.Tags != nil {
			job.Tags = req.Options.Tags
		}
		if req.Options.ScheduledAt != "" {
			job.State = StateScheduled
			job.ScheduledAt = req.Options.ScheduledAt
		}
	}

	m.mu.Lock()
	m.jobs[job.ID] = job
	if job.State == StateAvailable {
		m.addToQueue(job)
	}
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(job, "", job.State)
	}

	w.Header().Set("Location", "/ojs/v1/jobs/"+job.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"job": job})
}

func (m *MemoryBackend) handleGetJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	m.mu.RLock()
	job, ok := m.jobs[id]
	m.mu.RUnlock()

	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "Job not found: "+id)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": job})
}

func (m *MemoryBackend) handleCancelJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	m.mu.Lock()
	job, ok := m.jobs[id]
	if !ok {
		m.mu.Unlock()
		writeError(w, http.StatusNotFound, "not_found", "Job not found: "+id)
		return
	}

	fromState := job.State
	if !isValidTransition(fromState, StateCancelled) {
		m.mu.Unlock()
		writeError(w, http.StatusConflict, "invalid_request",
			fmt.Sprintf("Cannot cancel job in state %q.", fromState))
		return
	}

	job.State = StateCancelled
	job.CancelledAt = nowFormatted()
	m.removeFromQueue(job)
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(job, fromState, StateCancelled)
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": job})
}

func (m *MemoryBackend) handleFetch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Queues   []string `json:"queues"`
		Count    int      `json:"count,omitempty"`
		WorkerID string   `json:"worker_id,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON: "+err.Error())
		return
	}

	if len(req.Queues) == 0 {
		req.Queues = []string{"default"}
	}
	if req.Count <= 0 {
		req.Count = 1
	}

	m.mu.Lock()
	var fetched []*MemoryJob
	for _, q := range req.Queues {
		if len(fetched) >= req.Count {
			break
		}
		remaining := req.Count - len(fetched)
		jobs := m.queues[q]
		take := remaining
		if take > len(jobs) {
			take = len(jobs)
		}
		for i := 0; i < take; i++ {
			job := jobs[i]
			fromState := job.State
			job.State = StateActive
			job.StartedAt = nowFormatted()
			job.Attempt++
			fetched = append(fetched, job)
			if m.onStateChange != nil {
				defer func(j *MemoryJob, fs string) {
					m.onStateChange(j, fs, StateActive)
				}(job, fromState)
			}
		}
		m.queues[q] = jobs[take:]
	}
	m.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{"jobs": fetched})
}

func (m *MemoryBackend) handleAck(w http.ResponseWriter, r *http.Request) {
	var req struct {
		JobID  string          `json:"job_id"`
		Result json.RawMessage `json:"result,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON: "+err.Error())
		return
	}

	m.mu.Lock()
	job, ok := m.jobs[req.JobID]
	if !ok {
		m.mu.Unlock()
		writeError(w, http.StatusNotFound, "not_found", "Job not found: "+req.JobID)
		return
	}

	fromState := job.State
	if !isValidTransition(fromState, StateCompleted) {
		m.mu.Unlock()
		writeError(w, http.StatusConflict, "invalid_request",
			fmt.Sprintf("Cannot ack job in state %q.", fromState))
		return
	}

	job.State = StateCompleted
	job.CompletedAt = nowFormatted()
	if req.Result != nil {
		job.Result = req.Result
	}
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(job, fromState, StateCompleted)
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": job})
}

func (m *MemoryBackend) handleNack(w http.ResponseWriter, r *http.Request) {
	var req struct {
		JobID   string          `json:"job_id"`
		Error   json.RawMessage `json:"error,omitempty"`
		Requeue bool            `json:"requeue,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid JSON: "+err.Error())
		return
	}

	m.mu.Lock()
	job, ok := m.jobs[req.JobID]
	if !ok {
		m.mu.Unlock()
		writeError(w, http.StatusNotFound, "not_found", "Job not found: "+req.JobID)
		return
	}

	fromState := job.State
	targetState := StateRetryable
	if job.Attempt >= job.MaxAttempts {
		targetState = StateDiscarded
	}

	if !isValidTransition(fromState, targetState) {
		m.mu.Unlock()
		writeError(w, http.StatusConflict, "invalid_request",
			fmt.Sprintf("Cannot nack job in state %q.", fromState))
		return
	}

	job.State = targetState
	if req.Error != nil {
		job.Error = req.Error
	}

	// If retryable, re-add to available after a brief moment
	if targetState == StateRetryable {
		job.State = StateAvailable
		m.addToQueue(job)
	}
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(job, fromState, targetState)
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": job})
}

func (m *MemoryBackend) handleListQueues(w http.ResponseWriter, r *http.Request) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	type queueInfo struct {
		Name      string `json:"name"`
		Available int    `json:"available"`
	}

	var queues []queueInfo
	seen := make(map[string]bool)

	// Count available jobs per queue
	for q, jobs := range m.queues {
		queues = append(queues, queueInfo{Name: q, Available: len(jobs)})
		seen[q] = true
	}

	// Include queues with no available jobs but existing jobs
	for _, j := range m.jobs {
		if !seen[j.Queue] {
			queues = append(queues, queueInfo{Name: j.Queue, Available: 0})
			seen[j.Queue] = true
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"queues": queues})
}

// addToQueue inserts a job into its queue sorted by priority (desc).
// Must be called with m.mu held.
func (m *MemoryBackend) addToQueue(job *MemoryJob) {
	q := m.queues[job.Queue]
	q = append(q, job)
	sort.Slice(q, func(i, j int) bool {
		return q[i].Priority > q[j].Priority
	})
	m.queues[job.Queue] = q
}

// removeFromQueue removes a job from its queue.
// Must be called with m.mu held.
func (m *MemoryBackend) removeFromQueue(job *MemoryJob) {
	q := m.queues[job.Queue]
	for i, j := range q {
		if j.ID == job.ID {
			m.queues[job.Queue] = append(q[:i], q[i+1:]...)
			return
		}
	}
}

// GetJob returns a job by ID (for use by API handlers).
func (m *MemoryBackend) GetJob(id string) (*MemoryJob, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	j, ok := m.jobs[id]
	return j, ok
}

// ListJobs returns all jobs (for use by API handlers).
func (m *MemoryBackend) ListJobs() []*MemoryJob {
	m.mu.RLock()
	defer m.mu.RUnlock()

	jobs := make([]*MemoryJob, 0, len(m.jobs))
	for _, j := range m.jobs {
		jobs = append(jobs, j)
	}
	return jobs
}
