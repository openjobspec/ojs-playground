package share

import (
	"encoding/json"
	"testing"
	"time"
)

func TestLinkStoreCreateAndGet(t *testing.T) {
	store := NewLinkStore(time.Hour)
	state := PlaygroundState{
		Version:  "1.0",
		Code:     "client.enqueue('email.send', ['test@example.com'])",
		Language: "typescript",
		Backend:  "lite",
		Title:    "Email Example",
	}

	link, err := store.Create(state)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if link.ID == "" {
		t.Error("expected non-empty ID")
	}

	got, ok := store.Get(link.ID)
	if !ok {
		t.Fatal("expected to find link")
	}
	if got.State.Title != "Email Example" {
		t.Errorf("expected title 'Email Example', got %s", got.State.Title)
	}
	if got.ViewCount != 1 {
		t.Errorf("expected view count 1, got %d", got.ViewCount)
	}
}

func TestLinkStoreGetNotFound(t *testing.T) {
	store := NewLinkStore(time.Hour)
	_, ok := store.Get("nonexistent")
	if ok {
		t.Error("expected not found")
	}
}

func TestLinkStoreExpiration(t *testing.T) {
	store := NewLinkStore(time.Millisecond)
	state := PlaygroundState{Code: "test"}
	link, _ := store.Create(state)
	time.Sleep(10 * time.Millisecond)

	_, ok := store.Get(link.ID)
	if ok {
		t.Error("expected expired link to not be found")
	}
}

func TestLinkStorePrune(t *testing.T) {
	store := NewLinkStore(time.Millisecond)
	store.Create(PlaygroundState{Code: "1"})
	store.Create(PlaygroundState{Code: "2"})
	time.Sleep(10 * time.Millisecond)

	removed := store.Prune()
	if removed != 2 {
		t.Errorf("expected 2 pruned, got %d", removed)
	}
	if store.Count() != 0 {
		t.Errorf("expected 0 links, got %d", store.Count())
	}
}

func TestLinkStoreDeterministicID(t *testing.T) {
	store := NewLinkStore(time.Hour)
	state := PlaygroundState{Code: "same content"}

	link1, _ := store.Create(state)
	// Same content should produce same ID (idempotent)
	store2 := NewLinkStore(time.Hour)
	link2, _ := store2.Create(state)

	if link1.ID != link2.ID {
		t.Errorf("expected same ID for same content, got %s vs %s", link1.ID, link2.ID)
	}
}

func TestEncodeDecodeStateURL(t *testing.T) {
	state := PlaygroundState{
		Version:  "1.0",
		Code:     "client.enqueue('test', [1, 2, 3])",
		Language: "typescript",
		Backend:  "lite",
	}

	encoded, err := EncodeStateToURL(state)
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	if encoded == "" {
		t.Error("expected non-empty encoded string")
	}

	decoded, err := DecodeStateFromURL(encoded)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if decoded.Code != state.Code {
		t.Errorf("expected code %s, got %s", state.Code, decoded.Code)
	}
	if decoded.Language != state.Language {
		t.Errorf("expected language %s, got %s", state.Language, decoded.Language)
	}
}

func TestEncodeDecodeStateWithSchema(t *testing.T) {
	state := PlaygroundState{
		Version: "1.0",
		Schema:  json.RawMessage(`{"jobs":[{"type":"email.send","args":[{"name":"to","type":"string"}]}]}`),
	}

	encoded, _ := EncodeStateToURL(state)
	decoded, err := DecodeStateFromURL(encoded)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if decoded.Schema == nil {
		t.Error("expected schema to be preserved")
	}
}

func TestDecodeInvalidBase64(t *testing.T) {
	_, err := DecodeStateFromURL("!!!invalid!!!")
	if err == nil {
		t.Error("expected error for invalid base64")
	}
}

func TestDecodeInvalidJSON(t *testing.T) {
	_, err := DecodeStateFromURL("bm90LWpzb24")
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}
