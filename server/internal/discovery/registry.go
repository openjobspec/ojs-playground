package discovery

import (
	"sync"
	"time"

	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

// WorkerStatus represents the status of a discovered worker.
type WorkerStatus string

const (
	WorkerConnected    WorkerStatus = "connected"
	WorkerDisconnected WorkerStatus = "disconnected"
)

// DiscoveredWorker holds information about a discovered OJS worker.
type DiscoveredWorker struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	URL          string       `json:"url"`
	Port         int          `json:"port"`
	Status       WorkerStatus `json:"status"`
	Queues       []string     `json:"queues,omitempty"`
	JobTypes     []string     `json:"job_types,omitempty"`
	LastSeen     time.Time    `json:"last_seen"`
	FailCount    int          `json:"-"`
}

// Registry manages discovered workers.
type Registry struct {
	mu          sync.RWMutex
	workers     map[string]*DiscoveredWorker
	broadcaster *sse.Broadcaster
}

// NewRegistry creates a new worker registry.
func NewRegistry(broadcaster *sse.Broadcaster) *Registry {
	return &Registry{
		workers:     make(map[string]*DiscoveredWorker),
		broadcaster: broadcaster,
	}
}

// Register adds or updates a worker in the registry.
func (r *Registry) Register(worker *DiscoveredWorker) {
	r.mu.Lock()
	existing, isNew := r.workers[worker.ID]
	if !isNew || existing == nil {
		worker.Status = WorkerConnected
		worker.LastSeen = time.Now()
		r.workers[worker.ID] = worker
	} else {
		existing.Status = WorkerConnected
		existing.LastSeen = time.Now()
		existing.FailCount = 0
	}
	r.mu.Unlock()

	if r.broadcaster != nil {
		r.broadcaster.Broadcast(sse.Event{
			Type:      sse.EventWorkerConnected,
			Timestamp: time.Now(),
			Data: map[string]any{
				"worker_id": worker.ID,
				"name":      worker.Name,
				"url":       worker.URL,
			},
		})
	}
}

// Unregister removes a worker from the registry.
func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	worker, ok := r.workers[id]
	if ok {
		delete(r.workers, id)
	}
	r.mu.Unlock()

	if ok && r.broadcaster != nil {
		r.broadcaster.Broadcast(sse.Event{
			Type:      sse.EventWorkerDisconnected,
			Timestamp: time.Now(),
			Data: map[string]any{
				"worker_id": id,
				"name":      worker.Name,
			},
		})
	}
}

// MarkDisconnected marks a worker as disconnected.
func (r *Registry) MarkDisconnected(id string) {
	r.mu.Lock()
	if w, ok := r.workers[id]; ok {
		w.Status = WorkerDisconnected
		w.FailCount++
	}
	r.mu.Unlock()
}

// List returns all registered workers.
func (r *Registry) List() []*DiscoveredWorker {
	r.mu.RLock()
	defer r.mu.RUnlock()

	workers := make([]*DiscoveredWorker, 0, len(r.workers))
	for _, w := range r.workers {
		workers = append(workers, w)
	}
	return workers
}

// Get returns a worker by ID.
func (r *Registry) Get(id string) (*DiscoveredWorker, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	w, ok := r.workers[id]
	return w, ok
}

// Count returns the number of registered workers.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.workers)
}

// Connected returns the number of connected workers.
func (r *Registry) Connected() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	count := 0
	for _, w := range r.workers {
		if w.Status == WorkerConnected {
			count++
		}
	}
	return count
}
