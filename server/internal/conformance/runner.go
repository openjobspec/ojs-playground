package conformance

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/openjobspec/ojs-playground/server/internal/sse"
)

const maxConformanceResponseBytes = 2 << 20

// Runner executes conformance tests programmatically.
type Runner struct {
	baseURL     string
	suites      *SuiteLoader
	broadcaster *sse.Broadcaster
	client      *http.Client
	resetTest   func()
	runMu       sync.Mutex
}

// SetTestReset configures a reset hook that is invoked before each test case.
func (r *Runner) SetTestReset(reset func()) {
	if r != nil {
		r.resetTest = reset
	}
}

// NewRunner creates a new conformance test runner.
func NewRunner(baseURL string, suites *SuiteLoader, broadcaster *sse.Broadcaster) *Runner {
	return &Runner{
		baseURL:     strings.TrimRight(baseURL, "/"),
		suites:      suites,
		broadcaster: broadcaster,
		client:      &http.Client{Timeout: 30 * time.Second},
	}
}

// TestCount returns the number of tests selected for a level.
func (r *Runner) TestCount(level int) int {
	if r == nil || r.suites == nil {
		return 0
	}
	return r.suites.CountForLevel(level)
}

// RunResult represents the result of a conformance test run.
type RunResult struct {
	ID              string       `json:"id"`
	Level           int          `json:"level"`
	Status          string       `json:"status"`
	Error           string       `json:"error,omitempty"`
	StartedAt       time.Time    `json:"started_at"`
	EndedAt         *time.Time   `json:"ended_at,omitempty"`
	Total           int          `json:"total"`
	Passed          int          `json:"passed"`
	Failed          int          `json:"failed"`
	Skipped         int          `json:"skipped"`
	RunnerErrors    int          `json:"runner_errors"`
	BackendFailures int          `json:"backend_failures"`
	Tests           []TestResult `json:"tests,omitempty"`
	Duration        int64        `json:"duration_ms"`
}

// TestResult represents the result of a single test case.
type TestResult struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Level       int    `json:"level"`
	Category    string `json:"category"`
	Status      string `json:"status"`
	FailureType string `json:"failure_type,omitempty"`
	Error       string `json:"error,omitempty"`
	Duration    int64  `json:"duration_ms"`
}

// Run executes conformance tests for the given level.
func (r *Runner) Run(ctx context.Context, runID string, level int) *RunResult {
	result := &RunResult{
		ID:        runID,
		Level:     level,
		Status:    "running",
		StartedAt: time.Now(),
	}
	if r == nil || r.suites == nil {
		return finishRun(result, "failed", "Conformance suites are unavailable")
	}
	r.runMu.Lock()
	defer r.runMu.Unlock()

	tests := r.suites.GetTests(level)
	result.Total = len(tests)
	if result.Total == 0 {
		return finishRun(result, "failed", "No conformance tests are available for the requested level")
	}

	for _, test := range tests {
		if err := ctx.Err(); err != nil {
			return finishRun(result, "cancelled", "Conformance run was cancelled")
		}
		if r.resetTest != nil {
			r.resetTest()
		}

		testResult := r.runSingleTest(ctx, test)
		result.Tests = append(result.Tests, testResult)
		switch testResult.Status {
		case "passed":
			result.Passed++
		case "failed":
			result.Failed++
			if testResult.FailureType == FailureRunner {
				result.RunnerErrors++
			} else {
				result.BackendFailures++
			}
		case "skipped":
			result.Skipped++
		}

		if r.broadcaster != nil {
			r.broadcaster.Broadcast(sse.Event{
				Type:      "conformance:progress",
				Timestamp: time.Now(),
				Data: map[string]any{
					"run_id":         runID,
					"test_id":        testResult.ID,
					"status":         testResult.Status,
					"failure_type":   testResult.FailureType,
					"passed":         result.Passed,
					"failed":         result.Failed,
					"runner_errors":  result.RunnerErrors,
					"backend_failed": result.BackendFailures,
					"total":          result.Total,
				},
			})
		}
	}

	status := "completed"
	if result.Failed > 0 {
		status = "failed"
	}
	return finishRun(result, status, "")
}

func finishRun(result *RunResult, status, message string) *RunResult {
	now := time.Now()
	result.Status = status
	result.Error = message
	result.EndedAt = &now
	result.Duration = time.Since(result.StartedAt).Milliseconds()
	return result
}

func (r *Runner) runSingleTest(ctx context.Context, test TestDefinition) TestResult {
	start := time.Now()
	result := TestResult{
		ID:       test.ID,
		Name:     test.Name,
		Level:    test.Level,
		Category: test.Category,
	}
	execution := newTestExecutionContext()

	for index := 0; index < len(test.Steps); {
		step := test.Steps[index]
		if step.ID == "" {
			return failedTestResult(result, start, runnerErrorf("conformance step is missing an id"))
		}

		if step.ParallelWith != "" {
			partnerIndex := -1
			for candidate := index + 1; candidate < len(test.Steps); candidate++ {
				if test.Steps[candidate].ID == step.ParallelWith {
					partnerIndex = candidate
					break
				}
			}
			if partnerIndex < 0 {
				return failedTestResult(result, start, runnerErrorf(
					"step %q references unknown parallel step %q", step.ID, step.ParallelWith,
				))
			}
			if partnerIndex != index+1 || test.Steps[partnerIndex].ParallelWith != step.ID {
				return failedTestResult(result, start, runnerErrorf(
					"unsupported parallel step group %q/%q", step.ID, step.ParallelWith,
				))
			}

			steps := []TestStep{step, test.Steps[partnerIndex]}
			outcomes := make([]stepOutcome, len(steps))
			snapshot := execution.snapshot()
			var waitGroup sync.WaitGroup
			for outcomeIndex, parallelStep := range steps {
				waitGroup.Add(1)
				go func(position int, candidate TestStep) {
					defer waitGroup.Done()
					response, captures, err := r.executeStep(ctx, candidate, snapshot)
					outcomes[position] = stepOutcome{response: response, captures: captures, err: err}
				}(outcomeIndex, parallelStep)
			}
			waitGroup.Wait()

			for outcomeIndex, outcome := range outcomes {
				if outcome.err != nil {
					return failedTestResult(result, start, outcome.err)
				}
				if err := execution.store(steps[outcomeIndex].ID, outcome.response, outcome.captures); err != nil {
					return failedTestResult(result, start, err)
				}
			}
			index = partnerIndex + 1
			continue
		}

		response, captures, err := r.executeStep(ctx, step, execution)
		if err != nil {
			return failedTestResult(result, start, err)
		}
		if err := execution.store(step.ID, response, captures); err != nil {
			return failedTestResult(result, start, err)
		}
		index++
	}

	result.Status = "passed"
	result.Duration = time.Since(start).Milliseconds()
	return result
}

type stepOutcome struct {
	response *stepResponse
	captures map[string]any
	err      error
}

func failedTestResult(result TestResult, start time.Time, err error) TestResult {
	result.Status = "failed"
	result.FailureType = FailureBackend
	if isRunnerSemanticError(err) {
		result.FailureType = FailureRunner
	}
	result.Error = err.Error()
	result.Duration = time.Since(start).Milliseconds()
	return result
}

func (r *Runner) executeStep(
	ctx context.Context,
	step TestStep,
	execution *testExecutionContext,
) (*stepResponse, map[string]any, error) {
	if err := waitForContext(ctx, step.DelayMs); err != nil {
		return nil, nil, fmt.Errorf("step %q delay: %w", step.ID, err)
	}

	method := step.HTTPMethod()
	switch method {
	case "WAIT":
		if err := waitForContext(ctx, step.DurationMs); err != nil {
			return nil, nil, fmt.Errorf("step %q wait: %w", step.ID, err)
		}
		return &stepResponse{Headers: make(http.Header), BodyDecoded: true}, nil, nil
	case "ASSERT":
		if err := executeContextAssertions(step, execution); err != nil {
			return nil, nil, fmt.Errorf("step %q: %w", step.ID, err)
		}
		return &stepResponse{Headers: make(http.Header), BodyDecoded: true}, nil, nil
	case "":
		return nil, nil, runnerErrorf("step %q has no action", step.ID)
	}
	if step.Path == "" {
		return nil, nil, runnerErrorf("HTTP step %q has no path", step.ID)
	}

	path, err := resolveText(step.Path, execution)
	if err != nil {
		return nil, nil, fmt.Errorf("step %q path: %w", step.ID, err)
	}
	if !strings.HasPrefix(path, "/") {
		return nil, nil, runnerErrorf("step %q path %q is not absolute", step.ID, path)
	}

	body, hasBody, err := buildStepBody(step, execution)
	if err != nil {
		return nil, nil, fmt.Errorf("step %q body: %w", step.ID, err)
	}
	var bodyReader io.Reader
	if hasBody {
		bodyReader = strings.NewReader(body)
	}

	request, err := http.NewRequestWithContext(ctx, method, r.baseURL+path, bodyReader)
	if err != nil {
		return nil, nil, runnerErrorf("step %q request: %v", step.ID, err)
	}
	for name, value := range step.Headers {
		resolved, err := resolveText(value, execution)
		if err != nil {
			return nil, nil, fmt.Errorf("step %q header %q: %w", step.ID, name, err)
		}
		request.Header.Set(name, resolved)
	}
	if hasBody && request.Header.Get("Content-Type") == "" {
		request.Header.Set("Content-Type", "application/openjobspec+json")
	}

	response, err := r.client.Do(request)
	if err != nil {
		return nil, nil, fmt.Errorf("step %q execute request: %w", step.ID, err)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, maxConformanceResponseBytes+1))
	if err != nil {
		return nil, nil, fmt.Errorf("step %q read response: %w", step.ID, err)
	}
	if len(responseBody) > maxConformanceResponseBytes {
		return nil, nil, fmt.Errorf("step %q response body exceeds %d bytes", step.ID, maxConformanceResponseBytes)
	}

	captured := &stepResponse{
		Status:      response.StatusCode,
		Headers:     response.Header.Clone(),
		BodyDecoded: true,
	}
	if len(strings.TrimSpace(string(responseBody))) > 0 {
		if err := json.Unmarshal(responseBody, &captured.Body); err != nil {
			captured.BodyDecoded = false
		}
	}

	if err := evaluateStepAssertions(step, captured, execution); err != nil {
		return nil, nil, fmt.Errorf("step %q: %w", step.ID, err)
	}
	captures, err := captureStepValues(step, captured, execution)
	if err != nil {
		return nil, nil, fmt.Errorf("step %q captures: %w", step.ID, err)
	}
	return captured, captures, nil
}

func waitForContext(ctx context.Context, milliseconds int) error {
	if milliseconds <= 0 {
		return nil
	}
	timer := time.NewTimer(time.Duration(milliseconds) * time.Millisecond)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func buildStepBody(step TestStep, execution *testExecutionContext) (string, bool, error) {
	if step.RawBody != "" && len(step.Body) > 0 && string(step.Body) != "null" {
		return "", false, runnerErrorf("step defines both body and raw_body")
	}
	if step.RawBody != "" {
		resolved, err := resolveText(step.RawBody, execution)
		return resolved, true, err
	}
	if len(step.Body) == 0 || string(step.Body) == "null" {
		return "", false, nil
	}

	var decoded any
	if err := json.Unmarshal(step.Body, &decoded); err != nil {
		return "", false, runnerErrorf("invalid suite JSON body: %v", err)
	}
	if legacy, ok := decoded.(string); ok {
		if exactReferencePattern.MatchString(legacy) {
			resolved, err := resolveValue(legacy, execution)
			if err != nil {
				return "", false, err
			}
			encoded, err := json.Marshal(resolved)
			return string(encoded), true, err
		}
		resolved, err := resolveText(legacy, execution)
		return resolved, true, err
	}

	resolved, err := resolveValue(decoded, execution)
	if err != nil {
		return "", false, err
	}
	encoded, err := json.Marshal(resolved)
	if err != nil {
		return "", false, runnerErrorf("resolved request body cannot be encoded: %v", err)
	}
	return string(encoded), true, nil
}

func evaluateStepAssertions(
	step TestStep,
	response *stepResponse,
	execution *testExecutionContext,
) error {
	expectedStatus := step.Assertions.Status
	if expectedStatus == nil && step.ExpectStatus > 0 {
		expectedStatus = step.ExpectStatus
	}
	if expectedStatus != nil {
		resolved, err := resolveValue(expectedStatus, execution)
		if err != nil {
			return fmt.Errorf("status reference: %w", err)
		}
		if err := assertStatus(response.Status, resolved); err != nil {
			return fmt.Errorf("status: %w", err)
		}
	}

	for name, expected := range step.Assertions.Headers {
		resolved, err := resolveValue(expected, execution)
		if err != nil {
			return fmt.Errorf("header %q reference: %w", name, err)
		}
		actual := response.Headers.Get(name)
		if err := assertValue(actual, actual != "", resolved); err != nil {
			return fmt.Errorf("header %q: %w", name, err)
		}
	}

	bodyAssertions := step.Assertions.Body
	if bodyAssertions == nil && step.ExpectBody != nil {
		bodyAssertions = make(map[string]any, len(step.ExpectBody))
		for field, expected := range step.ExpectBody {
			bodyAssertions["$."+field] = expected
		}
	}
	if len(bodyAssertions) > 0 {
		if !response.BodyDecoded {
			return fmt.Errorf("response body is not a single valid JSON value")
		}
		if err := assertBodyAssertionMap(response.Body, bodyAssertions, execution); err != nil {
			return err
		}
	}
	return nil
}

func assertStatus(actual int, expected any) error {
	if matcher, ok := expected.(string); ok && strings.HasPrefix(matcher, "one_of:") {
		rawCodes := strings.Split(strings.TrimPrefix(matcher, "one_of:"), ",")
		if len(rawCodes) == 0 {
			return runnerErrorf("invalid status matcher %q", matcher)
		}
		for _, rawCode := range rawCodes {
			code, err := strconv.Atoi(strings.TrimSpace(rawCode))
			if err != nil {
				return runnerErrorf("invalid status matcher %q", matcher)
			}
			if actual == code {
				return nil
			}
		}
		return fmt.Errorf("expected status %s, got %d", matcher, actual)
	}
	return assertValue(float64(actual), true, expected)
}

func assertBodyAssertionMap(
	body any,
	assertions map[string]any,
	execution *testExecutionContext,
) error {
	for path, expected := range assertions {
		if path == "$or" {
			alternatives, ok := expected.([]any)
			if !ok || len(alternatives) == 0 {
				return runnerErrorf("top-level $or requires a non-empty array")
			}
			var lastMismatch error
			for _, alternative := range alternatives {
				alternativeMap, ok := alternative.(map[string]any)
				if !ok {
					return runnerErrorf("top-level $or alternatives must be assertion objects")
				}
				err := assertBodyAssertionMap(body, alternativeMap, execution)
				if err == nil {
					lastMismatch = nil
					break
				}
				if isRunnerSemanticError(err) {
					return err
				}
				lastMismatch = err
			}
			if lastMismatch != nil {
				return fmt.Errorf("no $or alternative matched: %w", lastMismatch)
			}
			continue
		}
		if path == "$empty" {
			resolved, err := resolveValue(expected, execution)
			if err != nil {
				return err
			}
			if err := assertValue(body, true, map[string]any{"$empty": resolved}); err != nil {
				return fmt.Errorf("$empty: %w", err)
			}
			continue
		}
		if strings.HasPrefix(path, "$") && !strings.HasPrefix(path, "$.") && path != "$" {
			return runnerErrorf("unsupported top-level body assertion %q", path)
		}

		resolvedPath, err := resolveText(path, execution)
		if err != nil {
			return fmt.Errorf("assertion path %q: %w", path, err)
		}
		actual, exists, err := lookupJSONPath(body, resolvedPath)
		if err != nil {
			return fmt.Errorf("%s: %w", resolvedPath, err)
		}
		resolvedExpected, err := resolveValue(expected, execution)
		if err != nil {
			return fmt.Errorf("%s reference: %w", resolvedPath, err)
		}
		if err := assertValue(actual, exists, resolvedExpected); err != nil {
			return fmt.Errorf("%s: %w", resolvedPath, err)
		}
	}
	return nil
}

func captureStepValues(
	step TestStep,
	response *stepResponse,
	execution *testExecutionContext,
) (map[string]any, error) {
	if len(step.Captures) == 0 {
		return nil, nil
	}
	if !response.BodyDecoded {
		return nil, fmt.Errorf("response body is not valid JSON")
	}
	captures := make(map[string]any, len(step.Captures))
	for name, path := range step.Captures {
		if name == "" || strings.Contains(name, ".") {
			return nil, runnerErrorf("invalid capture name %q", name)
		}
		resolvedPath, err := resolveText(path, execution)
		if err != nil {
			return nil, err
		}
		value, exists, err := lookupJSONPath(response.Body, resolvedPath)
		if err != nil {
			return nil, err
		}
		if !exists {
			return nil, fmt.Errorf("capture %q path %q was not present", name, resolvedPath)
		}
		captures[name] = value
	}
	return captures, nil
}

func executeContextAssertions(step TestStep, execution *testExecutionContext) error {
	hasAssertion := false
	if step.Assertions.ExclusiveClaim != nil {
		hasAssertion = true
		if err := assertExclusiveClaim(step.Assertions.ExclusiveClaim, execution); err != nil {
			return fmt.Errorf("exclusive_claim: %w", err)
		}
	}
	if len(step.Assertions.Equality) > 0 {
		hasAssertion = true
		synthetic := execution.syntheticValue()
		for path, expected := range step.Assertions.Equality {
			resolvedPath, err := resolveText(path, execution)
			if err != nil {
				return err
			}
			actual, exists, err := lookupJSONPath(synthetic, resolvedPath)
			if err != nil {
				return err
			}
			if !exists {
				return fmt.Errorf("equality path %q was not present", resolvedPath)
			}
			resolvedExpected, err := resolveValue(expected, execution)
			if err != nil {
				return err
			}
			if !jsonValuesEqual(actual, resolvedExpected) {
				return fmt.Errorf("equality %s: expected %v, got %v", resolvedPath, resolvedExpected, actual)
			}
		}
	}
	if !hasAssertion {
		return runnerErrorf("ASSERT step has no supported assertion")
	}
	return nil
}

func assertExclusiveClaim(assertion *ExclusiveClaimAssertion, execution *testExecutionContext) error {
	jobValue, err := resolveValue(assertion.JobID, execution)
	if err != nil {
		return err
	}
	jobID, ok := jobValue.(string)
	if !ok || jobID == "" {
		return runnerErrorf("exclusive_claim job_id must resolve to a non-empty string")
	}
	if len(assertion.Fetches) == 0 {
		return runnerErrorf("exclusive_claim fetches must not be empty")
	}

	hasJobCount := 0
	emptyCount := 0
	for _, rawFetch := range assertion.Fetches {
		resolved, err := resolveValue(rawFetch, execution)
		if err != nil {
			return err
		}
		jobs, ok := resolved.([]any)
		if !ok {
			return fmt.Errorf("fetch reference resolved to %T instead of an array", resolved)
		}
		if len(jobs) == 0 {
			emptyCount++
		}
		for _, rawJob := range jobs {
			job, ok := rawJob.(map[string]any)
			if ok && fmt.Sprint(job["id"]) == jobID {
				hasJobCount++
				break
			}
		}
	}
	if assertion.ExactlyOneHasJob && hasJobCount != 1 {
		return fmt.Errorf("expected exactly one fetch to contain job %q, got %d", jobID, hasJobCount)
	}
	if assertion.ExactlyOneEmpty && emptyCount != 1 {
		return fmt.Errorf("expected exactly one empty fetch, got %d", emptyCount)
	}
	return nil
}
