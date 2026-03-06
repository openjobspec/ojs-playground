package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/openjobspec/ojs-playground/server/internal/ai"
)

// AIHandler provides HTTP endpoints for the AI-assisted job design feature.
type AIHandler struct{}

// NewAIHandler creates a new AI handler.
func NewAIHandler() *AIHandler {
	return &AIHandler{}
}

// ListTemplates handles GET /api/ai/templates — returns all starter templates.
func (h *AIHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")

	var templates []ai.StarterTemplate
	if category != "" {
		templates = ai.GetTemplatesByCategory(category)
	} else {
		templates = ai.GetTemplates()
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"templates":  templates,
		"count":      len(templates),
		"categories": ai.GetCategories(),
	})
}

// GetTemplate handles GET /api/ai/templates/{id} — returns a single template.
func (h *AIHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Path[len("/api/ai/templates/"):]

	tmpl, ok := ai.GetTemplate(id)
	if !ok {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "template not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"template": tmpl})
}

// GetSystemPrompt handles GET /api/ai/prompt — returns the LLM system prompt.
func (h *AIHandler) GetSystemPrompt(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"system_prompt": ai.SystemPrompt,
		"instructions":  "Send this as the system message to any OpenAI/Anthropic-compatible API along with the user's job description as the user message.",
	})
}

// Generate handles POST /api/ai/generate — placeholder for LLM-backed generation.
// In production, this would call an LLM API. For now, it matches against templates.
func (h *AIHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req ai.GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request body"})
		return
	}

	// If a template is specified, return its manifest
	if req.Template != "" {
		tmpl, ok := ai.GetTemplate(req.Template)
		if ok {
			writeJSON(w, http.StatusOK, ai.GenerateResponse{
				Manifest: tmpl.Manifest,
				Language: req.Language,
			})
			return
		}
	}

	// Try template matching from prompt keywords
	if req.Prompt != "" {
		templates := ai.GetTemplates()
		prompt := strings.ToLower(req.Prompt)

		for _, tmpl := range templates {
			name := strings.ToLower(tmpl.Name)
			desc := strings.ToLower(tmpl.Description)
			cat := strings.ToLower(tmpl.Category)
			id := strings.ToLower(tmpl.ID)

			if strings.Contains(prompt, name) || strings.Contains(prompt, id) ||
				strings.Contains(prompt, cat) || containsAnyWord(prompt, desc) {
				writeJSON(w, http.StatusOK, ai.GenerateResponse{
					Manifest: tmpl.Manifest,
					Language: req.Language,
					Code:     fmt.Sprintf("// Matched template: %s\n// For AI-powered generation, use the system prompt at GET /api/ai/prompt with your own API key.", tmpl.Name),
				})
				return
			}
		}
	}

	// Fallback: return first template with guidance
	templates := ai.GetTemplates()
	if len(templates) > 0 {
		writeJSON(w, http.StatusOK, ai.GenerateResponse{
			Manifest: templates[0].Manifest,
			Language: req.Language,
			Code:     fmt.Sprintf("// Default template: %s\n// For custom AI generation, use GET /api/ai/prompt to get the system prompt, then call your preferred LLM API.", templates[0].Name),
		})
		return
	}

	writeJSON(w, http.StatusOK, ai.GenerateResponse{
		Errors: []string{
			"No templates available. Use the system prompt at GET /api/ai/prompt with your own API key.",
		},
	})
}

// containsAnyWord checks if any significant word (3+ chars) from text appears in prompt.
func containsAnyWord(prompt, text string) bool {
	for _, word := range strings.Fields(text) {
		if len(word) >= 3 && strings.Contains(prompt, word) {
			return true
		}
	}
	return false
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
