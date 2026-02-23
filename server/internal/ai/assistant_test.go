package ai

import (
	"testing"
)

func TestGetTemplates(t *testing.T) {
	templates := GetTemplates()
	if len(templates) < 5 {
		t.Errorf("expected at least 5 templates, got %d", len(templates))
	}
}

func TestGetTemplateByID(t *testing.T) {
	tmpl, ok := GetTemplate("email-notification")
	if !ok {
		t.Fatal("expected to find email-notification template")
	}
	if tmpl.Category != "communication" {
		t.Errorf("expected communication category, got %s", tmpl.Category)
	}
	if tmpl.Manifest == "" {
		t.Error("expected non-empty manifest")
	}
}

func TestGetTemplateNotFound(t *testing.T) {
	_, ok := GetTemplate("nonexistent")
	if ok {
		t.Error("expected template not found")
	}
}

func TestGetTemplatesByCategory(t *testing.T) {
	media := GetTemplatesByCategory("media")
	if len(media) != 1 {
		t.Errorf("expected 1 media template, got %d", len(media))
	}
}

func TestGetCategories(t *testing.T) {
	categories := GetCategories()
	if len(categories) < 4 {
		t.Errorf("expected at least 4 categories, got %d", len(categories))
	}
}

func TestTemplatesJSON(t *testing.T) {
	data, err := TemplatesJSON()
	if err != nil {
		t.Fatalf("TemplatesJSON: %v", err)
	}
	if len(data) < 100 {
		t.Error("expected substantial JSON output")
	}
}

func TestSystemPromptNotEmpty(t *testing.T) {
	if len(SystemPrompt) < 100 {
		t.Error("expected substantial system prompt")
	}
}

func TestAllTemplatesHaveRequiredFields(t *testing.T) {
	for _, tmpl := range GetTemplates() {
		if tmpl.ID == "" {
			t.Error("template missing ID")
		}
		if tmpl.Name == "" {
			t.Errorf("template %s missing Name", tmpl.ID)
		}
		if tmpl.Description == "" {
			t.Errorf("template %s missing Description", tmpl.ID)
		}
		if tmpl.Category == "" {
			t.Errorf("template %s missing Category", tmpl.ID)
		}
		if tmpl.Manifest == "" {
			t.Errorf("template %s missing Manifest", tmpl.ID)
		}
	}
}
