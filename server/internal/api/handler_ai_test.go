package api

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/openjobspec/ojs-playground/server/internal/ai"
)

func TestListTemplates(t *testing.T) {
	h := NewAIHandler()
	req := httptest.NewRequest("GET", "/api/ai/templates", nil)
	rec := httptest.NewRecorder()
	h.ListTemplates(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	count := int(resp["count"].(float64))
	if count < 5 {
		t.Errorf("expected at least 5 templates, got %d", count)
	}
}

func TestListTemplatesByCategory(t *testing.T) {
	h := NewAIHandler()
	req := httptest.NewRequest("GET", "/api/ai/templates?category=media", nil)
	rec := httptest.NewRecorder()
	h.ListTemplates(rec, req)

	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	count := int(resp["count"].(float64))
	if count != 1 {
		t.Errorf("expected 1 media template, got %d", count)
	}
}

func TestGetTemplate(t *testing.T) {
	h := NewAIHandler()
	req := httptest.NewRequest("GET", "/api/ai/templates/email-notification", nil)
	rec := httptest.NewRecorder()
	h.GetTemplate(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestGetTemplateNotFound(t *testing.T) {
	h := NewAIHandler()
	req := httptest.NewRequest("GET", "/api/ai/templates/nonexistent", nil)
	rec := httptest.NewRecorder()
	h.GetTemplate(rec, req)

	if rec.Code != 404 {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestGetSystemPrompt(t *testing.T) {
	h := NewAIHandler()
	req := httptest.NewRequest("GET", "/api/ai/prompt", nil)
	rec := httptest.NewRecorder()
	h.GetSystemPrompt(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	prompt := resp["system_prompt"].(string)
	if len(prompt) < 100 {
		t.Error("expected substantial system prompt")
	}
}

func TestGenerateWithTemplate(t *testing.T) {
	h := NewAIHandler()
	body, _ := json.Marshal(ai.GenerateRequest{
		Template: "email-notification",
		Language: "go",
	})
	req := httptest.NewRequest("POST", "/api/ai/generate", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.Generate(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp ai.GenerateResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp.Manifest == "" {
		t.Error("expected manifest from template")
	}
}

func TestGenerateWithoutLLM(t *testing.T) {
	h := NewAIHandler()
	body, _ := json.Marshal(ai.GenerateRequest{
		Prompt: "Create a job that sends SMS messages",
	})
	req := httptest.NewRequest("POST", "/api/ai/generate", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.Generate(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp ai.GenerateResponse
	json.NewDecoder(rec.Body).Decode(&resp)
	// Generate is a template-matching placeholder: with no LLM configured it must
	// degrade gracefully by returning a usable manifest plus guidance that points
	// at the system-prompt endpoint, rather than failing or returning nothing.
	if resp.Manifest == "" {
		t.Error("expected a fallback template manifest when no LLM is configured")
	}
	if !strings.Contains(resp.Code, "/api/ai/prompt") {
		t.Errorf("expected guidance referencing the system-prompt endpoint, got %q", resp.Code)
	}
}
