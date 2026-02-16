package sse

import (
	"testing"
	"time"
)

func TestSubscribeAndBroadcast(t *testing.T) {
	b := NewBroadcaster()

	sub, unsub := b.Subscribe(SubscribeFilter{})
	defer unsub()

	if b.Count() != 1 {
		t.Fatalf("expected 1 subscriber, got %d", b.Count())
	}

	event := Event{
		Type:      EventJobStateChanged,
		Data:      map[string]string{"state": "active"},
		Timestamp: time.Now(),
	}

	b.Broadcast(event)

	select {
	case e := <-sub.Ch:
		if e.Type != EventJobStateChanged {
			t.Errorf("expected type %s, got %s", EventJobStateChanged, e.Type)
		}
		if e.ID == "" {
			t.Error("expected non-empty event ID")
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}
}

func TestUnsubscribe(t *testing.T) {
	b := NewBroadcaster()

	_, unsub := b.Subscribe(SubscribeFilter{})
	if b.Count() != 1 {
		t.Fatalf("expected 1 subscriber, got %d", b.Count())
	}

	unsub()

	if b.Count() != 0 {
		t.Errorf("expected 0 subscribers after unsub, got %d", b.Count())
	}
}

func TestFilterByType(t *testing.T) {
	b := NewBroadcaster()

	sub, unsub := b.Subscribe(SubscribeFilter{
		Types: map[string]bool{EventJobCompleted: true},
	})
	defer unsub()

	// Broadcast non-matching event
	b.Broadcast(Event{Type: EventChaosActivated, Timestamp: time.Now()})

	// Broadcast matching event
	b.Broadcast(Event{Type: EventJobCompleted, Timestamp: time.Now()})

	select {
	case e := <-sub.Ch:
		if e.Type != EventJobCompleted {
			t.Errorf("expected %s, got %s", EventJobCompleted, e.Type)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for filtered event")
	}
}

func TestFilterByQueue(t *testing.T) {
	b := NewBroadcaster()

	sub, unsub := b.Subscribe(SubscribeFilter{Queue: "email"})
	defer unsub()

	// Non-matching queue
	b.Broadcast(Event{Type: EventJobCompleted, Queue: "reports", Timestamp: time.Now()})

	// Matching queue
	b.Broadcast(Event{Type: EventJobCompleted, Queue: "email", Timestamp: time.Now()})

	select {
	case e := <-sub.Ch:
		if e.Queue != "email" {
			t.Errorf("expected queue email, got %s", e.Queue)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for queue-filtered event")
	}
}

func TestFilterByJobID(t *testing.T) {
	b := NewBroadcaster()

	sub, unsub := b.Subscribe(SubscribeFilter{JobID: "job-123"})
	defer unsub()

	b.Broadcast(Event{Type: EventJobCompleted, JobID: "job-456", Timestamp: time.Now()})
	b.Broadcast(Event{Type: EventJobCompleted, JobID: "job-123", Timestamp: time.Now()})

	select {
	case e := <-sub.Ch:
		if e.JobID != "job-123" {
			t.Errorf("expected job-123, got %s", e.JobID)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for job-filtered event")
	}
}

func TestSlowConsumerDrop(t *testing.T) {
	b := NewBroadcaster()

	sub, unsub := b.Subscribe(SubscribeFilter{})
	defer unsub()

	// Fill the channel buffer (64) + extra
	for i := 0; i < channelBufferSize+10; i++ {
		b.Broadcast(Event{Type: EventJobCompleted, Timestamp: time.Now()})
	}

	// Should have received up to buffer size
	count := 0
	for {
		select {
		case <-sub.Ch:
			count++
		default:
			goto done
		}
	}
done:
	if count != channelBufferSize {
		t.Errorf("expected %d events (buffer size), got %d", channelBufferSize, count)
	}
}

func TestMultipleSubscribers(t *testing.T) {
	b := NewBroadcaster()

	sub1, unsub1 := b.Subscribe(SubscribeFilter{})
	defer unsub1()
	sub2, unsub2 := b.Subscribe(SubscribeFilter{})
	defer unsub2()

	if b.Count() != 2 {
		t.Fatalf("expected 2 subscribers, got %d", b.Count())
	}

	b.Broadcast(Event{Type: EventJobCompleted, Timestamp: time.Now()})

	for _, sub := range []*Subscriber{sub1, sub2} {
		select {
		case e := <-sub.Ch:
			if e.Type != EventJobCompleted {
				t.Errorf("expected %s, got %s", EventJobCompleted, e.Type)
			}
		case <-time.After(time.Second):
			t.Fatal("timed out waiting for event")
		}
	}
}

func TestEventIDsIncrement(t *testing.T) {
	b := NewBroadcaster()

	sub, unsub := b.Subscribe(SubscribeFilter{})
	defer unsub()

	b.Broadcast(Event{Type: EventJobCompleted, Timestamp: time.Now()})
	b.Broadcast(Event{Type: EventJobCompleted, Timestamp: time.Now()})

	e1 := <-sub.Ch
	e2 := <-sub.Ch

	if e1.ID == e2.ID {
		t.Errorf("expected different event IDs, both got %s", e1.ID)
	}
	if e1.ID >= e2.ID {
		t.Errorf("expected incrementing IDs, got %s then %s", e1.ID, e2.ID)
	}
}

func TestEmptyFilterMatchesAll(t *testing.T) {
	b := NewBroadcaster()

	sub, unsub := b.Subscribe(SubscribeFilter{})
	defer unsub()

	b.Broadcast(Event{Type: EventJobCompleted, Queue: "any", JobID: "any-id", Timestamp: time.Now()})

	select {
	case <-sub.Ch:
		// Success — empty filter matches everything
	case <-time.After(time.Second):
		t.Fatal("empty filter should match all events")
	}
}
