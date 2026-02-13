package chaos

import (
	"sync"
	"sync/atomic"
	"time"
)

// Config holds thread-safe chaos engineering state.
type Config struct {
	mu           sync.RWMutex
	failNextN    atomic.Int64
	latencyMs    int
	timeoutNext  bool
	pausedQueues map[string]bool
}

// NewConfig creates a new chaos config with everything disabled.
func NewConfig() *Config {
	return &Config{
		pausedQueues: make(map[string]bool),
	}
}

// State represents a snapshot of the chaos configuration.
type State struct {
	FailNextN    int64    `json:"fail_next_n"`
	LatencyMs    int      `json:"latency_ms"`
	TimeoutNext  bool     `json:"timeout_next"`
	PausedQueues []string `json:"paused_queues"`
}

// Get returns a snapshot of the current chaos state.
func (c *Config) Get() State {
	c.mu.RLock()
	defer c.mu.RUnlock()

	queues := make([]string, 0, len(c.pausedQueues))
	for q := range c.pausedQueues {
		queues = append(queues, q)
	}

	return State{
		FailNextN:    c.failNextN.Load(),
		LatencyMs:    c.latencyMs,
		TimeoutNext:  c.timeoutNext,
		PausedQueues: queues,
	}
}

// Update applies new chaos settings.
type UpdateRequest struct {
	FailNextN    *int64   `json:"fail_next_n,omitempty"`
	LatencyMs    *int     `json:"latency_ms,omitempty"`
	TimeoutNext  *bool    `json:"timeout_next,omitempty"`
	PausedQueues []string `json:"paused_queues,omitempty"`
}

func (c *Config) Update(req UpdateRequest) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if req.FailNextN != nil {
		c.failNextN.Store(*req.FailNextN)
	}
	if req.LatencyMs != nil {
		c.latencyMs = *req.LatencyMs
	}
	if req.TimeoutNext != nil {
		c.timeoutNext = *req.TimeoutNext
	}
	if req.PausedQueues != nil {
		c.pausedQueues = make(map[string]bool)
		for _, q := range req.PausedQueues {
			c.pausedQueues[q] = true
		}
	}
}

// Reset disables all chaos settings.
func (c *Config) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.failNextN.Store(0)
	c.latencyMs = 0
	c.timeoutNext = false
	c.pausedQueues = make(map[string]bool)
}

// ShouldFail atomically decrements failNextN and returns true if the request should fail.
func (c *Config) ShouldFail() bool {
	for {
		current := c.failNextN.Load()
		if current <= 0 {
			return false
		}
		if c.failNextN.CompareAndSwap(current, current-1) {
			return true
		}
	}
}

// GetDelay returns the configured latency delay.
func (c *Config) GetDelay() time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return time.Duration(c.latencyMs) * time.Millisecond
}

// ShouldTimeout returns and clears the timeout flag.
func (c *Config) ShouldTimeout() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.timeoutNext {
		c.timeoutNext = false
		return true
	}
	return false
}

// IsQueuePaused returns whether a queue is paused by chaos config.
func (c *Config) IsQueuePaused(queue string) bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.pausedQueues[queue]
}
