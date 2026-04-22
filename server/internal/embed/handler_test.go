package embed

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSPAHandlerServesWebComponentArtifact(t *testing.T) {
	recorder := httptest.NewRecorder()
	SPAHandler().ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/ojs-playground.js", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.Contains(contentType, "javascript") {
		t.Fatalf("expected JavaScript content type, got %q", contentType)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "customElements.define") || !strings.Contains(body, "ojs-playground") {
		t.Fatal("embedded web component registration is missing")
	}
}
