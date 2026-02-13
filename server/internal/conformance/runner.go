package conformance

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

// Runner executes conformance tests programmatically.
type Runner struct {
	baseURL     string
	suites      *SuiteLoader
	broadcaster *sse.Broadcaster
}

// NewRunner creates a new conformance test runner.
func NewRunner(baseURL string, suites *SuiteLoader, broadcaster *sse.Broadcaster) *Runner {
	return &Runner{
		baseURL:     baseURL,
		suites:      suites,
		broadcaster: broadcaster,
	}
}

// RunResult represents the result of a conformance test run.
type RunResult struct {
	ID         string        `json:"id"`
	Level      int           `json:"level"`
	Status     string        `json:"status"` // "running", "completed", "failed"
	StartedAt  time.Time     `json:"started_at"`
	EndedAt    *time.Time    `json:"ended_at,omitempty"`
	Total      int           `json:"total"`
	Passed     int           `json:"passed"`
	Failed     int           `json:"failed"`
	Skipped    int           `json:"skipped"`
	Tests      []TestResult  `json:"tests,omitempty"`
	Duration   time.Duration `json:"duration_ms"`
}

// TestResult represents the result of a single test case.
type TestResult struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Level    int    `json:"level"`
	Category string `json:"category"`
	Status   string `json:"status"` // "passed", "failed", "skipped"
	Error    string `json:"error,omitempty"`
	Duration int64  `json:"duration_ms"`
}

// Run executes conformance tests for the given level.
func (r *Runner) Run(ctx context.Context, runID string, level int) *RunResult {
	result := &RunResult{
		ID:        runID,
		Level:     level,
		Status:    "running",
		StartedAt: time.Now(),
	}

	tests := r.suites.GetTests(level)
	result.Total = len(tests)

	for _, test := range tests {
		select {
		case <-ctx.Done():
			result.Status = "failed"
			now := time.Now()
			result.EndedAt = &now
			result.Duration = time.Since(result.StartedAt)
			return result
		default:
		}

		tr := r.runSingleTest(ctx, test)
		result.Tests = append(result.Tests, tr)

		switch tr.Status {
		case "passed":
			result.Passed++
		case "failed":
			result.Failed++
		case "skipped":
			result.Skipped++
		}

		// Broadcast progress
		if r.broadcaster != nil {
			r.broadcaster.Broadcast(sse.Event{
				Type:      "conformance:progress",
				Timestamp: time.Now(),
				Data: map[string]any{
					"run_id":  runID,
					"test_id": tr.ID,
					"status":  tr.Status,
					"passed":  result.Passed,
					"failed":  result.Failed,
					"total":   result.Total,
				},
			})
		}
	}

	now := time.Now()
	result.EndedAt = &now
	result.Duration = time.Since(result.StartedAt)
	if result.Failed > 0 {
		result.Status = "failed"
	} else {
		result.Status = "completed"
	}

	return result
}

func (r *Runner) runSingleTest(ctx context.Context, test TestDefinition) TestResult {
	start := time.Now()
	tr := TestResult{
		ID:       test.ID,
		Name:     test.Name,
		Level:    test.Level,
		Category: test.Category,
	}

	for _, step := range test.Steps {
		err := r.executeStep(ctx, step)
		if err != nil {
			tr.Status = "failed"
			tr.Error = err.Error()
			tr.Duration = time.Since(start).Milliseconds()
			return tr
		}
	}

	tr.Status = "passed"
	tr.Duration = time.Since(start).Milliseconds()
	return tr
}

func (r *Runner) executeStep(ctx context.Context, step TestStep) error {
	url := r.baseURL + step.Path

	var body *strings.Reader
	if step.Body != "" {
		body = strings.NewReader(step.Body)
	}

	var req *http.Request
	var err error
	if body != nil {
		req, err = http.NewRequestWithContext(ctx, step.Method, url, body)
	} else {
		req, err = http.NewRequestWithContext(ctx, step.Method, url, nil)
	}
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	if step.Body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	// Check status code assertion
	if step.ExpectStatus > 0 && resp.StatusCode != step.ExpectStatus {
		return fmt.Errorf("expected status %d, got %d", step.ExpectStatus, resp.StatusCode)
	}

	// Check response body assertions
	if step.ExpectBody != nil {
		var respBody map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}

		for field, expected := range step.ExpectBody {
			actual, ok := respBody[field]
			if !ok {
				return fmt.Errorf("expected field %q not in response", field)
			}
			if fmt.Sprintf("%v", actual) != fmt.Sprintf("%v", expected) {
				return fmt.Errorf("field %q: expected %v, got %v", field, expected, actual)
			}
		}
	}

	if step.DelayMs > 0 {
		slog.Debug("conformance step delay", "delay_ms", step.DelayMs)
		time.Sleep(time.Duration(step.DelayMs) * time.Millisecond)
	}

	return nil
}
