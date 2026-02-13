package sse

import (
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/google/uuid"
)

const channelBufferSize = 64

// Subscriber represents a connected SSE client.
type Subscriber struct {
	ID     string
	Ch     chan Event
	Filter SubscribeFilter
}

// SubscribeFilter specifies which events a subscriber wants.
type SubscribeFilter struct {
	Queue  string
	JobID  string
	Types  map[string]bool
}

// Broadcaster distributes events to all connected SSE clients.
type Broadcaster struct {
	mu          sync.RWMutex
	subscribers map[string]*Subscriber
	eventID     atomic.Uint64
}

// NewBroadcaster creates a new Broadcaster.
func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		subscribers: make(map[string]*Subscriber),
	}
}

// Subscribe creates a new subscription. Returns the subscriber and an unsubscribe function.
func (b *Broadcaster) Subscribe(filter SubscribeFilter) (*Subscriber, func()) {
	sub := &Subscriber{
		ID:     uuid.New().String()[:8],
		Ch:     make(chan Event, channelBufferSize),
		Filter: filter,
	}

	b.mu.Lock()
	b.subscribers[sub.ID] = sub
	b.mu.Unlock()

	unsub := func() {
		b.mu.Lock()
		delete(b.subscribers, sub.ID)
		b.mu.Unlock()
		close(sub.Ch)
	}

	return sub, unsub
}

// Broadcast sends an event to all matching subscribers.
// Non-blocking: drops events for slow consumers.
func (b *Broadcaster) Broadcast(event Event) {
	event.ID = uintToEventID(b.eventID.Add(1))

	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, sub := range b.subscribers {
		if !matchesFilter(event, sub.Filter) {
			continue
		}
		// Non-blocking send
		select {
		case sub.Ch <- event:
		default:
			// Drop event for slow consumer
		}
	}
}

// Count returns the number of active subscribers.
func (b *Broadcaster) Count() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subscribers)
}

func matchesFilter(event Event, filter SubscribeFilter) bool {
	if filter.Queue != "" && event.Queue != "" && event.Queue != filter.Queue {
		return false
	}
	if filter.JobID != "" && event.JobID != "" && event.JobID != filter.JobID {
		return false
	}
	if len(filter.Types) > 0 && !filter.Types[event.Type] {
		return false
	}
	return true
}

func uintToEventID(n uint64) string {
	return fmt.Sprintf("%d", n)
}
