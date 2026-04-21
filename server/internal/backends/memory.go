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

	"github.com/openjobspec/ojs-playground/server/internal/httpjson"
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
	SpecVersion         string                     `json:"specversion"`
	ID                  string                     `json:"id"`
	Type                string                     `json:"type"`
	State               string                     `json:"state"`
	Queue               string                     `json:"queue"`
	Args                json.RawMessage            `json:"args"`
	Meta                json.RawMessage            `json:"meta,omitempty"`
	Schema              string                     `json:"schema,omitempty"`
	Priority            int                        `json:"priority"`
	Attempt             int                        `json:"attempt"`
	MaxAttempts         int                        `json:"max_attempts"`
	TimeoutMs           *int                       `json:"timeout_ms,omitempty"`
	VisibilityTimeoutMs *int                       `json:"visibility_timeout_ms,omitempty"`
	Retry               json.RawMessage            `json:"retry,omitempty"`
	Unique              json.RawMessage            `json:"unique,omitempty"`
	CreatedAt           string                     `json:"created_at"`
	EnqueuedAt          string                     `json:"enqueued_at,omitempty"`
	StartedAt           string                     `json:"started_at,omitempty"`
	CompletedAt         string                     `json:"completed_at,omitempty"`
	CancelledAt         string                     `json:"cancelled_at,omitempty"`
	ScheduledAt         string                     `json:"scheduled_at,omitempty"`
	ExpiresAt           string                     `json:"expires_at,omitempty"`
	Result              json.RawMessage            `json:"result,omitempty"`
	Error               json.RawMessage            `json:"error,omitempty"`
	Tags                []string                   `json:"tags,omitempty"`
	Extensions          map[string]json.RawMessage `json:"-"`
}

type memoryEnqueueRequest struct {
	ID         string                     `json:"id,omitempty"`
	Type       string                     `json:"type"`
	Args       json.RawMessage            `json:"args"`
	Meta       json.RawMessage            `json:"meta,omitempty"`
	Schema     string                     `json:"schema,omitempty"`
	Options    *memoryJobOptions          `json:"options,omitempty"`
	Extensions map[string]json.RawMessage `json:"-"`
}

type memoryJobOptions struct {
	Queue               string          `json:"queue,omitempty"`
	Priority            *int            `json:"priority,omitempty"`
	TimeoutMs           *int            `json:"timeout_ms,omitempty"`
	DelayUntil          string          `json:"delay_until,omitempty"`
	ScheduledAt         string          `json:"scheduled_at,omitempty"`
	ExpiresAt           string          `json:"expires_at,omitempty"`
	Retry               json.RawMessage `json:"retry,omitempty"`
	Unique              json.RawMessage `json:"unique,omitempty"`
	Tags                []string        `json:"tags,omitempty"`
	VisibilityTimeoutMs *int            `json:"visibility_timeout_ms,omitempty"`
}

func (r *memoryEnqueueRequest) UnmarshalJSON(data []byte) error {
	type requestAlias memoryEnqueueRequest
	var decoded requestAlias
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	for _, name := range []string{"id", "type", "args", "meta", "schema", "options"} {
		delete(fields, name)
	}
	*r = memoryEnqueueRequest(decoded)
	r.Extensions = cloneRawMap(fields)
	return nil
}

// MarshalJSON preserves unknown top-level envelope attributes without allowing
// them to replace server-managed fields.
func (j MemoryJob) MarshalJSON() ([]byte, error) {
	type memoryJobAlias MemoryJob
	base, err := json.Marshal(memoryJobAlias(j))
	if err != nil {
		return nil, err
	}
	if len(j.Extensions) == 0 {
		return base, nil
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(base, &fields); err != nil {
		return nil, err
	}
	for name, value := range j.Extensions {
		if _, exists := fields[name]; exists {
			continue
		}
		fields[name] = cloneRawMessage(value)
	}
	return json.Marshal(fields)
}

func cloneRawMessage(value json.RawMessage) json.RawMessage {
	if value == nil {
		return nil
	}
	return append(json.RawMessage(nil), value...)
}

func cloneRawMap(values map[string]json.RawMessage) map[string]json.RawMessage {
	if values == nil {
		return nil
	}
	clone := make(map[string]json.RawMessage, len(values))
	for name, value := range values {
		clone[name] = cloneRawMessage(value)
	}
	return clone
}

func cloneMemoryJob(job *MemoryJob) *MemoryJob {
	if job == nil {
		return nil
	}
	clone := *job
	clone.Args = cloneRawMessage(job.Args)
	clone.Meta = cloneRawMessage(job.Meta)
	clone.Retry = cloneRawMessage(job.Retry)
	clone.Unique = cloneRawMessage(job.Unique)
	clone.Result = cloneRawMessage(job.Result)
	clone.Error = cloneRawMessage(job.Error)
	clone.Tags = append([]string(nil), job.Tags...)
	if job.Extensions != nil {
		clone.Extensions = make(map[string]json.RawMessage, len(job.Extensions))
		for name, value := range job.Extensions {
			clone.Extensions[name] = cloneRawMessage(value)
		}
	}
	if job.TimeoutMs != nil {
		timeout := *job.TimeoutMs
		clone.TimeoutMs = &timeout
	}
	if job.VisibilityTimeoutMs != nil {
		timeout := *job.VisibilityTimeoutMs
		clone.VisibilityTimeoutMs = &timeout
	}
	return &clone
}

// StateChangeCallback is called when a job state changes.
type StateChangeCallback func(job *MemoryJob, fromState, toState string)

// MemoryBackend implements a full Level 0 OJS backend in memory.
type MemoryBackend struct {
	mu            sync.RWMutex
	jobs          map[string]*MemoryJob
	queues        map[string][]*MemoryJob // queue name → available jobs (sorted by priority)
	onStateChange StateChangeCallback
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

// Reset removes all jobs and queues so conformance tests can run in isolation.
func (m *MemoryBackend) Reset() {
	m.mu.Lock()
	m.jobs = make(map[string]*MemoryJob)
	m.queues = make(map[string][]*MemoryJob)
	m.mu.Unlock()
}

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
	w.Header().Set("OJS-Version", "1.0")
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
		"status":  "ok",
		"backend": "memory",
	})
}

func (m *MemoryBackend) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var req memoryEnqueueRequest
	if decodeErr := httpjson.DecodeLenient(w, r, &req, httpjson.MaxProtocolRequestBytes, false); decodeErr != nil {
		writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
		return
	}

	if req.Type == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "Field 'type' is required.")
		return
	}
	if len(req.Type) > httpjson.MaxTypeLength {
		writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'type' is too large.")
		return
	}

	if req.Args == nil {
		req.Args = json.RawMessage(`[]`)
	}
	if _, decodeErr := httpjson.RequireJSONArray("args", req.Args, httpjson.MaxArgsBytes, 1000); decodeErr != nil {
		writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
		return
	}
	if req.Meta != nil {
		if _, decodeErr := httpjson.RequireJSONObject("meta", req.Meta, httpjson.MaxMetaBytes, 1000, false); decodeErr != nil {
			writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
			return
		}
	}
	if len(req.ID) > httpjson.MaxWorkerIDLength {
		writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'id' is too large.")
		return
	}
	if len(req.Schema) > 2048 {
		writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'schema' is too large.")
		return
	}

	id := req.ID
	if id == "" {
		uid, _ := uuid.NewV7()
		id = uid.String()
	}

	currentTime := time.Now().UTC()
	now := currentTime.Format("2006-01-02T15:04:05.000Z")
	job := &MemoryJob{
		SpecVersion: "1.0",
		ID:          id,
		Type:        req.Type,
		State:       StateAvailable,
		Queue:       "default",
		Args:        req.Args,
		Meta:        req.Meta,
		Schema:      req.Schema,
		Priority:    0,
		Attempt:     0,
		MaxAttempts: 3,
		CreatedAt:   now,
		EnqueuedAt:  now,
		Extensions:  cloneRawMap(req.Extensions),
	}

	if req.Options != nil {
		if req.Options.Queue != "" {
			if len(req.Options.Queue) > httpjson.MaxQueueLength {
				writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'options.queue' is too large.")
				return
			}
			job.Queue = req.Options.Queue
		}
		if req.Options.Priority != nil {
			if *req.Options.Priority < -100 || *req.Options.Priority > 100 {
				writeError(w, http.StatusBadRequest, "validation_error", "Field 'options.priority' is out of range.")
				return
			}
			job.Priority = *req.Options.Priority
		}
		if req.Options.TimeoutMs != nil {
			if *req.Options.TimeoutMs < 0 || *req.Options.TimeoutMs > 24*60*60*1000 {
				writeError(w, http.StatusBadRequest, "validation_error", "Field 'options.timeout_ms' is out of range.")
				return
			}
			job.TimeoutMs = req.Options.TimeoutMs
		}
		if req.Options.VisibilityTimeoutMs != nil {
			if *req.Options.VisibilityTimeoutMs < 1000 || *req.Options.VisibilityTimeoutMs > 24*60*60*1000 {
				writeError(w, http.StatusBadRequest, "validation_error", "Field 'options.visibility_timeout_ms' is out of range.")
				return
			}
			job.VisibilityTimeoutMs = req.Options.VisibilityTimeoutMs
		}
		if req.Options.Tags != nil {
			if len(req.Options.Tags) > httpjson.MaxStringListItems {
				writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'options.tags' has too many items.")
				return
			}
			for _, tag := range req.Options.Tags {
				if len(tag) > 128 {
					writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "A tag is too large.")
					return
				}
			}
			job.Tags = req.Options.Tags
		}
		scheduledAt := req.Options.DelayUntil
		if scheduledAt == "" {
			scheduledAt = req.Options.ScheduledAt
		}
		if scheduledAt != "" {
			if len(scheduledAt) > 64 {
				writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'options.delay_until' is too large.")
				return
			}
			parsed, err := time.Parse(time.RFC3339, scheduledAt)
			if err != nil {
				writeError(w, http.StatusBadRequest, "validation_error", "Field 'options.delay_until' must be an RFC 3339 timestamp.")
				return
			}
			job.ScheduledAt = scheduledAt
			if parsed.After(currentTime) {
				job.State = StateScheduled
				job.EnqueuedAt = ""
			}
		}
		if req.Options.ExpiresAt != "" {
			if len(req.Options.ExpiresAt) > 64 {
				writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'options.expires_at' is too large.")
				return
			}
			if _, err := time.Parse(time.RFC3339, req.Options.ExpiresAt); err != nil {
				writeError(w, http.StatusBadRequest, "validation_error", "Field 'options.expires_at' must be an RFC 3339 timestamp.")
				return
			}
			job.ExpiresAt = req.Options.ExpiresAt
		}
		if req.Options.Retry != nil {
			if _, decodeErr := httpjson.RequireJSONObject("options.retry", req.Options.Retry, httpjson.MaxMetaBytes, 100, false); decodeErr != nil {
				writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
				return
			}
			var retry struct {
				MaxAttempts *int `json:"max_attempts,omitempty"`
			}
			if err := json.Unmarshal(req.Options.Retry, &retry); err != nil {
				writeError(w, http.StatusBadRequest, "validation_error", "Field 'options.retry' is invalid.")
				return
			}
			if retry.MaxAttempts != nil {
				if *retry.MaxAttempts < 0 || *retry.MaxAttempts > 1000 {
					writeError(w, http.StatusBadRequest, "validation_error", "Field 'options.retry.max_attempts' is out of range.")
					return
				}
				job.MaxAttempts = *retry.MaxAttempts
			}
			job.Retry = cloneRawMessage(req.Options.Retry)
		}
		if req.Options.Unique != nil {
			if _, decodeErr := httpjson.RequireJSONObject("options.unique", req.Options.Unique, httpjson.MaxMetaBytes, 100, false); decodeErr != nil {
				writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
				return
			}
			job.Unique = cloneRawMessage(req.Options.Unique)
		}
	}

	m.mu.Lock()
	if _, exists := m.jobs[job.ID]; exists {
		m.mu.Unlock()
		writeError(w, http.StatusConflict, "duplicate", "Job already exists: "+job.ID)
		return
	}
	m.jobs[job.ID] = job
	if job.State == StateAvailable {
		m.addToQueue(job)
	}
	callbackJob := cloneMemoryJob(job)
	responseJob := cloneMemoryJob(job)
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(callbackJob, "", callbackJob.State)
	}

	w.Header().Set("Location", "/ojs/v1/jobs/"+responseJob.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"job": responseJob})
}

func (m *MemoryBackend) handleGetJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if len(id) == 0 || len(id) > httpjson.MaxWorkerIDLength {
		writeError(w, http.StatusBadRequest, "validation_error", "Job ID is invalid.")
		return
	}

	m.mu.RLock()
	job, ok := m.jobs[id]
	snapshot := cloneMemoryJob(job)
	m.mu.RUnlock()

	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "Job not found: "+id)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": snapshot})
}

func (m *MemoryBackend) handleCancelJob(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if len(id) == 0 || len(id) > httpjson.MaxWorkerIDLength {
		writeError(w, http.StatusBadRequest, "validation_error", "Job ID is invalid.")
		return
	}

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
	callbackJob := cloneMemoryJob(job)
	responseJob := cloneMemoryJob(job)
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(callbackJob, fromState, StateCancelled)
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": responseJob})
}

func (m *MemoryBackend) handleFetch(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Queues   []string `json:"queues"`
		Count    int      `json:"count,omitempty"`
		WorkerID string   `json:"worker_id,omitempty"`
	}

	if decodeErr := httpjson.DecodeLenient(w, r, &req, 64<<10, false); decodeErr != nil {
		writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
		return
	}

	if len(req.Queues) == 0 {
		req.Queues = []string{"default"}
	}
	if len(req.Queues) > httpjson.MaxStringListItems {
		writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'queues' has too many items.")
		return
	}
	for _, queue := range req.Queues {
		if len(queue) == 0 || len(queue) > httpjson.MaxQueueLength {
			writeError(w, http.StatusBadRequest, "validation_error", "Field 'queues' contains an invalid queue.")
			return
		}
	}
	if len(req.WorkerID) > httpjson.MaxWorkerIDLength {
		writeError(w, http.StatusRequestEntityTooLarge, "validation_error", "Field 'worker_id' is too large.")
		return
	}
	if req.Count <= 0 {
		req.Count = 1
	}
	if req.Count > httpjson.MaxFetchCount {
		req.Count = httpjson.MaxFetchCount
	}

	m.mu.Lock()
	fetched := make([]*MemoryJob, 0)
	type pendingChange struct {
		job       *MemoryJob
		fromState string
	}
	var changes []pendingChange
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
			fetched = append(fetched, cloneMemoryJob(job))
			changes = append(changes, pendingChange{job: cloneMemoryJob(job), fromState: fromState})
		}
		m.queues[q] = jobs[take:]
	}
	m.mu.Unlock()

	// Fire state-change callbacks after releasing the lock, in fetch order —
	// consistent with the other handlers. (Previously these were deferred to
	// the end of the handler, so they ran after the response, in reverse order.)
	if m.onStateChange != nil {
		for _, c := range changes {
			m.onStateChange(c.job, c.fromState, StateActive)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"jobs": fetched})
}

func (m *MemoryBackend) handleAck(w http.ResponseWriter, r *http.Request) {
	var req struct {
		JobID  string          `json:"job_id"`
		Result json.RawMessage `json:"result,omitempty"`
	}

	if decodeErr := httpjson.DecodeLenient(w, r, &req, httpjson.MaxProtocolRequestBytes, false); decodeErr != nil {
		writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
		return
	}
	if len(req.JobID) == 0 || len(req.JobID) > httpjson.MaxWorkerIDLength {
		writeError(w, http.StatusBadRequest, "validation_error", "Field 'job_id' is invalid.")
		return
	}
	if req.Result != nil {
		if decodeErr := httpjson.RequireRawJSON("result", req.Result, httpjson.MaxOutputBytes, false); decodeErr != nil {
			writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
			return
		}
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
		job.Result = cloneRawMessage(req.Result)
	}
	callbackJob := cloneMemoryJob(job)
	responseJob := cloneMemoryJob(job)
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(callbackJob, fromState, StateCompleted)
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": responseJob})
}

func (m *MemoryBackend) handleNack(w http.ResponseWriter, r *http.Request) {
	var req struct {
		JobID   string          `json:"job_id"`
		Error   json.RawMessage `json:"error,omitempty"`
		Requeue bool            `json:"requeue,omitempty"`
	}

	if decodeErr := httpjson.DecodeLenient(w, r, &req, httpjson.MaxProtocolRequestBytes, false); decodeErr != nil {
		writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
		return
	}
	if len(req.JobID) == 0 || len(req.JobID) > httpjson.MaxWorkerIDLength {
		writeError(w, http.StatusBadRequest, "validation_error", "Field 'job_id' is invalid.")
		return
	}
	if req.Error != nil {
		if decodeErr := httpjson.RequireRawJSON("error", req.Error, httpjson.MaxErrorBytes, false); decodeErr != nil {
			writeError(w, decodeErr.Status, "invalid_request", decodeErr.Message)
			return
		}
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
		job.Error = cloneRawMessage(req.Error)
	}

	// If retryable, re-add to available after a brief moment
	if targetState == StateRetryable {
		job.State = StateAvailable
		m.addToQueue(job)
	}
	callbackJob := cloneMemoryJob(job)
	responseJob := cloneMemoryJob(job)
	m.mu.Unlock()

	if m.onStateChange != nil {
		m.onStateChange(callbackJob, fromState, targetState)
	}

	writeJSON(w, http.StatusOK, map[string]any{"job": responseJob})
}

func (m *MemoryBackend) handleListQueues(w http.ResponseWriter, r *http.Request) {
	m.mu.RLock()

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
	m.mu.RUnlock()

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
	return cloneMemoryJob(j), ok
}

// ListJobs returns all jobs (for use by API handlers).
func (m *MemoryBackend) ListJobs() []*MemoryJob {
	m.mu.RLock()
	defer m.mu.RUnlock()

	jobs := make([]*MemoryJob, 0, len(m.jobs))
	for _, j := range m.jobs {
		jobs = append(jobs, cloneMemoryJob(j))
	}
	return jobs
}
