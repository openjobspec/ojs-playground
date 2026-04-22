package conformance

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/openjobspec/ojs-playground/server/internal/backends"
)

func TestTypedAndObjectMatchers(t *testing.T) {
	uuid := "019461a8-1a2b-7c3d-8e4f-5a6b7c8d9e0f"
	tests := []struct {
		name     string
		actual   any
		exists   bool
		expected any
	}{
		{"uuidv7", uuid, true, "string:uuidv7"},
		{"nonempty", "value", true, "string:nonempty"},
		{"non_empty", "value", true, "string:non_empty"},
		{"datetime", "2026-08-12T15:00:00Z", true, "string:datetime"},
		{"number range", float64(409), true, "number:range(400,422)"},
		{"array length function", []any{}, true, "array:length(0)"},
		{"array length colon", []any{"one"}, true, "array:length:1"},
		{"array minimum", []any{"one", "two"}, true, "array:min_length:2"},
		{"array min alias", []any{"one", "two"}, true, "array:min:2"},
		{"array contains", []any{"cron-a", "cron-b"}, true, "contains:cron-b"},
		{"array excludes", []any{"cron-a"}, true, "not_contains:cron-b"},
		{"string contains", "invalid max_attempts", true, "string:contains:max_attempts"},
		{"absent", nil, false, "absent"},
		{"exists type", "message", true, map[string]any{"$exists": true, "$type": "string"}},
		{"in", "conflict", true, map[string]any{"$in": []any{"invalid_request", "conflict"}}},
		{"regex", uuid, true, map[string]any{"$match": `^0194`}},
		{"size comparison", []any{1.0, 2.0}, true, map[string]any{"$size": map[string]any{"$gte": 1.0}}},
		{"comparison", float64(10), true, map[string]any{"$gte": 1.0, "$lt": 20.0}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := assertValue(test.actual, test.exists, test.expected); err != nil {
				t.Fatalf("matcher failed: %v", err)
			}
		})
	}
}

func TestUnknownMatchersAreRunnerErrors(t *testing.T) {
	for _, matcher := range []any{
		"string:not_a_real_matcher",
		map[string]any{"$unknown": true},
	} {
		err := assertValue("value", true, matcher)
		if err == nil || !isRunnerSemanticError(err) {
			t.Fatalf("matcher %#v returned %v, want a runner semantic error", matcher, err)
		}
		if !strings.Contains(err.Error(), "unsupported matcher") {
			t.Fatalf("matcher error was not clear: %v", err)
		}
	}
}

func TestStepReferencesCoverStatusHeadersBodiesAndJSONPath(t *testing.T) {
	execution := newTestExecutionContext()
	response := &stepResponse{
		Status:      http.StatusCreated,
		Headers:     http.Header{"Location": []string{"/ojs/v1/jobs/job-1"}},
		BodyDecoded: true,
		Body: map[string]any{
			"job": map[string]any{
				"id": "job-1",
				"args": []any{
					map[string]any{"name": "first"},
					map[string]any{"name": "second"},
				},
			},
			"jobs": []any{
				map[string]any{"id": "job-1", "state": "active"},
				map[string]any{"id": "job-2", "state": "available"},
			},
		},
	}
	if err := execution.store("enqueue", response, map[string]any{"job_id": "job-1"}); err != nil {
		t.Fatal(err)
	}

	cases := map[string]any{
		"steps.enqueue.response.status":                http.StatusCreated,
		"steps.enqueue.response.headers.Location":      "/ojs/v1/jobs/job-1",
		"steps.enqueue.response.body.job.id":           "job-1",
		"steps.enqueue.response.body.job.args[1].name": "second",
		"steps.enqueue.response.body.jobs[0].state":    "active",
		"captures.job_id":                              "job-1",
	}
	for reference, want := range cases {
		got, err := resolveReference(reference, execution)
		if err != nil {
			t.Fatalf("resolve %s: %v", reference, err)
		}
		if !jsonValuesEqual(got, want) {
			t.Fatalf("resolve %s = %#v, want %#v", reference, got, want)
		}
	}

	filtered, exists, err := lookupJSONPath(response.Body, "$.jobs[?(@.id=='job-2')].state")
	if err != nil || !exists || filtered != "available" {
		t.Fatalf("filtered JSONPath = %#v, %t, %v", filtered, exists, err)
	}
	wildcard, exists, err := lookupJSONPath(response.Body, "$.jobs[*].id")
	if err != nil || !exists || !jsonValuesEqual(wildcard, []any{"job-1", "job-2"}) {
		t.Fatalf("wildcard JSONPath = %#v, %t, %v", wildcard, exists, err)
	}

	resolved, err := resolveValue(map[string]any{
		"job_id": "{{steps.enqueue.response.body.job.id}}",
		"status": "{{steps.enqueue.response.status}}",
		"path":   "/jobs/{{steps.enqueue.response.body.job.id}}",
	}, execution)
	if err != nil {
		t.Fatal(err)
	}
	resolvedMap := resolved.(map[string]any)
	if resolvedMap["job_id"] != "job-1" || resolvedMap["status"] != http.StatusCreated ||
		resolvedMap["path"] != "/jobs/job-1" {
		t.Fatalf("unexpected recursive resolution: %#v", resolvedMap)
	}
}

func TestUnknownReferenceFailsClearlyWithoutLiteralComparison(t *testing.T) {
	_, err := resolveText("/jobs/{{steps.missing.response.body.job.id}}", newTestExecutionContext())
	if err == nil || !isRunnerSemanticError(err) {
		t.Fatalf("expected runner reference error, got %v", err)
	}
	if strings.Contains(err.Error(), "expected {{") {
		t.Fatalf("reference was treated as a literal comparison: %v", err)
	}
}

func TestStepContextsAreIsolatedAcrossTests(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"job":{"id":"job-1"}}`))
	}))
	defer server.Close()

	runner := NewRunner(server.URL, &SuiteLoader{}, nil)
	first := runner.runSingleTest(context.Background(), TestDefinition{
		ID: "first",
		Steps: []TestStep{{
			ID:     "step-1",
			Action: http.MethodGet,
			Path:   "/",
		}},
	})
	if first.Status != "passed" {
		t.Fatalf("first test failed: %+v", first)
	}

	second := runner.runSingleTest(context.Background(), TestDefinition{
		ID: "second",
		Steps: []TestStep{{
			ID:     "step-2",
			Action: http.MethodGet,
			Path:   "/{{steps.step-1.response.body.job.id}}",
		}},
	})
	if second.Status != "failed" || second.FailureType != FailureRunner ||
		!strings.Contains(second.Error, `unknown or later step "step-1"`) {
		t.Fatalf("step context leaked between tests: %+v", second)
	}
}

func TestRealSuiteRepresentativeTestsAgainstMemoryBackend(t *testing.T) {
	root := filepath.Clean("../../../../ojs-conformance/suites")
	if _, err := os.Stat(root); err != nil {
		t.Skip("workspace conformance repository is not present")
	}
	loader, err := NewSuiteLoader(root)
	if err != nil {
		t.Fatal(err)
	}

	testIDs := []string{
		"L0-ENV-001",
		"L0-ENV-002",
		"L0-ENV-014",
		"L0-ENV-017",
		"L0-LC-002",
		"L0-OPS-004",
		"L0-OPS-008",
		"L0-OPS-020",
		"L4-PRI-003",
	}
	for _, testID := range testIDs {
		testDefinition := findLoadedTest(t, loader, testID)
		t.Run(testID, func(t *testing.T) {
			router := chi.NewRouter()
			router.Mount("/ojs/v1", backends.NewMemoryBackend(nil).Router())
			server := httptest.NewServer(router)
			defer server.Close()

			result := NewRunner(server.URL, loader, nil).runSingleTest(context.Background(), testDefinition)
			if result.Status != "passed" {
				t.Fatalf("real suite test failed: %+v", result)
			}
			if strings.Contains(result.Error, "{{steps.") ||
				strings.Contains(result.Error, "string:uuidv7") ||
				strings.Contains(result.Error, "number:range(") {
				t.Fatalf("matcher/reference placeholder appeared literally: %q", result.Error)
			}
		})
	}
}

func TestCheckedOutCoreSuiteDSLInventoryIsSupported(t *testing.T) {
	root := filepath.Clean("../../../../ojs-conformance/suites")
	if _, err := os.Stat(root); err != nil {
		t.Skip("workspace conformance repository is not present")
	}
	loader, err := NewSuiteLoader(root)
	if err != nil {
		t.Fatal(err)
	}
	tests := loader.GetTests(4)
	if len(tests) != 133 {
		t.Fatalf("checked-out core suite count = %d, want 133", len(tests))
	}

	for _, definition := range tests {
		t.Run(definition.ID+"-"+definition.Name, func(t *testing.T) {
			execution := newTestExecutionContext()
			for _, step := range definition.Steps {
				execution.steps[step.ID] = &stepResponse{
					Status:      http.StatusOK,
					Headers:     http.Header{"Content-Type": []string{"application/openjobspec+json"}},
					Body:        map[string]any{},
					BodyDecoded: true,
				}
			}

			for _, step := range definition.Steps {
				switch step.HTTPMethod() {
				case http.MethodGet, http.MethodPost, http.MethodDelete, "WAIT", "ASSERT":
				default:
					t.Errorf("unsupported action %q", step.HTTPMethod())
				}
				assertMatcherSyntaxSupported(t, step.Assertions.Status)
				for _, matcher := range step.Assertions.Headers {
					assertMatcherSyntaxSupported(t, matcher)
				}
				for path, matcher := range step.Assertions.Body {
					if strings.HasPrefix(path, "$.") || path == "$" {
						sanitized := referencePattern.ReplaceAllString(path, "inventory-value")
						if _, err := parseJSONPath(sanitized); err != nil {
							t.Errorf("assertion JSONPath %q: %v", path, err)
						}
					}
					assertMatcherSyntaxSupported(t, matcher)
				}

				encoded, err := json.Marshal(step)
				if err != nil {
					t.Fatal(err)
				}
				for _, match := range referencePattern.FindAllStringSubmatch(string(encoded), -1) {
					if _, err := resolveReference(match[1], execution); err != nil && isRunnerSemanticError(err) {
						t.Errorf("unsupported reference %q: %v", match[1], err)
					}
				}
				for name, path := range step.Captures {
					if name == "" {
						t.Error("empty capture name")
					}
					if _, err := parseJSONPath(path); err != nil {
						t.Errorf("capture %q JSONPath %q: %v", name, path, err)
					}
				}
			}
		})
	}
}

func TestRealSuiteBackendFailureIsNotReportedAsRunnerUnsupported(t *testing.T) {
	root := filepath.Clean("../../../../ojs-conformance/suites")
	if _, err := os.Stat(root); err != nil {
		t.Skip("workspace conformance repository is not present")
	}
	loader, err := NewSuiteLoader(root)
	if err != nil {
		t.Fatal(err)
	}
	testDefinition := findLoadedTest(t, loader, "L0-OPS-032")

	router := chi.NewRouter()
	router.Mount("/ojs/v1", backends.NewMemoryBackend(nil).Router())
	server := httptest.NewServer(router)
	defer server.Close()

	result := NewRunner(server.URL, loader, nil).runSingleTest(context.Background(), testDefinition)
	if result.Status != "failed" || result.FailureType != FailureBackend {
		t.Fatalf("expected a genuine backend failure, got %+v", result)
	}
	if strings.Contains(result.Error, "{{steps.") || strings.Contains(result.Error, "unsupported matcher") {
		t.Fatalf("backend gap was reported as a runner placeholder error: %q", result.Error)
	}
}

func findLoadedTest(t *testing.T, loader *SuiteLoader, id string) TestDefinition {
	t.Helper()
	for _, testDefinition := range loader.GetTests(4) {
		if testDefinition.ID == id {
			return testDefinition
		}
	}
	t.Fatalf("real suite test %s was not loaded", id)
	return TestDefinition{}
}

func TestBuildStepBodyPreservesReferencedJSONTypes(t *testing.T) {
	execution := newTestExecutionContext()
	if err := execution.store("fetch", &stepResponse{
		Headers:     make(http.Header),
		BodyDecoded: true,
		Body: map[string]any{
			"jobs": []any{map[string]any{"id": "job-1"}},
		},
	}, nil); err != nil {
		t.Fatal(err)
	}
	step := TestStep{
		Body: json.RawMessage(`{"jobs":"{{steps.fetch.response.body.jobs}}","label":"job-{{steps.fetch.response.body.jobs[0].id}}"}`),
	}
	body, hasBody, err := buildStepBody(step, execution)
	if err != nil || !hasBody {
		t.Fatalf("build body: %q, %t, %v", body, hasBody, err)
	}
	var decoded map[string]any
	if err := json.Unmarshal([]byte(body), &decoded); err != nil {
		t.Fatal(err)
	}
	if _, ok := decoded["jobs"].([]any); !ok || decoded["label"] != "job-job-1" {
		t.Fatalf("referenced JSON types were not preserved: %#v", decoded)
	}
}

func assertMatcherSyntaxSupported(t *testing.T, matcher any) {
	t.Helper()
	if matcher == nil {
		return
	}
	switch typed := matcher.(type) {
	case string:
		var actual any = typed
		exists := true
		switch {
		case typed == "absent":
			exists = false
			actual = nil
		case strings.HasPrefix(typed, "string:"):
			actual = "inventory"
		case strings.HasPrefix(typed, "number:"), strings.HasPrefix(typed, "~"):
			actual = float64(1)
		case strings.HasPrefix(typed, "boolean:"):
			actual = true
		case strings.HasPrefix(typed, "array:"), strings.HasPrefix(typed, "contains:"), strings.HasPrefix(typed, "not_contains:"):
			actual = []any{"inventory"}
		case strings.HasPrefix(typed, "object:"):
			actual = map[string]any{"inventory": true}
		}
		if err := assertValue(actual, exists, typed); err != nil && isRunnerSemanticError(err) {
			t.Errorf("unsupported matcher %q: %v", typed, err)
		}
	case []any:
		for _, value := range typed {
			assertMatcherSyntaxSupported(t, value)
		}
	case map[string]any:
		hasAssertionPath := false
		for key := range typed {
			if strings.HasPrefix(key, "$.") || key == "$" {
				hasAssertionPath = true
			}
		}
		for _, value := range typed {
			assertMatcherSyntaxSupported(t, value)
		}
		if hasAssertionPath {
			return
		}
		var actual any = map[string]any{}
		if _, ok := typed["$size"]; ok {
			actual = []any{}
		} else if _, ok := typed["$match"]; ok {
			actual = "inventory"
		} else if _, ok := typed["$gte"]; ok {
			actual = float64(1)
		}
		if err := assertValue(actual, true, typed); err != nil && isRunnerSemanticError(err) {
			t.Errorf("unsupported object matcher %#v: %v", typed, err)
		}
	}
}
