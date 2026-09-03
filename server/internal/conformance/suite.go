package conformance

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ErrSuitesUnavailable indicates that no executable core suites were loaded.
var ErrSuitesUnavailable = errors.New("conformance suites unavailable")

// TestDefinition represents a conformance test case.
type TestDefinition struct {
	ID          string     `json:"test_id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Level       int        `json:"level"`
	Category    string     `json:"category"`
	Steps       []TestStep `json:"steps"`
}

// UnmarshalJSON retains compatibility with the playground's legacy "id" key.
func (t *TestDefinition) UnmarshalJSON(data []byte) error {
	type definitionAlias TestDefinition
	var value struct {
		definitionAlias
		LegacyID string `json:"id"`
	}
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	*t = TestDefinition(value.definitionAlias)
	if t.ID == "" {
		t.ID = value.LegacyID
	}
	return nil
}

// TestAssertions contains the assertion constructs used by the core suites.
type TestAssertions struct {
	Status         any                      `json:"status,omitempty"`
	Headers        map[string]any           `json:"headers,omitempty"`
	Body           map[string]any           `json:"body,omitempty"`
	ExclusiveClaim *ExclusiveClaimAssertion `json:"exclusive_claim,omitempty"`
	Equality       map[string]any           `json:"equality,omitempty"`
}

// ExclusiveClaimAssertion verifies at-most-once delivery across fetch results.
type ExclusiveClaimAssertion struct {
	JobID            any   `json:"job_id"`
	Fetches          []any `json:"fetches"`
	ExactlyOneHasJob bool  `json:"exactly_one_has_job"`
	ExactlyOneEmpty  bool  `json:"exactly_one_empty"`
}

// TestStep represents a single HTTP step.
type TestStep struct {
	ID           string            `json:"id"`
	Action       string            `json:"action,omitempty"`
	Method       string            `json:"method,omitempty"`
	Path         string            `json:"path"`
	Headers      map[string]string `json:"headers,omitempty"`
	Body         json.RawMessage   `json:"body,omitempty"`
	RawBody      string            `json:"raw_body,omitempty"`
	Assertions   TestAssertions    `json:"assertions,omitempty"`
	ExpectStatus int               `json:"expect_status,omitempty"`
	ExpectBody   map[string]any    `json:"expect_body,omitempty"`
	DelayMs      int               `json:"delay_ms,omitempty"`
	DurationMs   int               `json:"duration_ms,omitempty"`
	ParallelWith string            `json:"parallel_with,omitempty"`
	Captures     map[string]string `json:"captures,omitempty"`
}

func (s TestStep) HTTPMethod() string {
	if s.Action != "" {
		return strings.ToUpper(s.Action)
	}
	return strings.ToUpper(s.Method)
}

// SuiteLoader loads core level test definitions from disk.
type SuiteLoader struct {
	tests []TestDefinition
}

// NewSuiteLoader creates a suite loader from the conformance suites root.
func NewSuiteLoader(suitesDir string) (*SuiteLoader, error) {
	if suitesDir == "" {
		return nil, fmt.Errorf("%w: no suites directory configured", ErrSuitesUnavailable)
	}
	info, err := os.Stat(suitesDir)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrSuitesUnavailable, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%w: %s is not a directory", ErrSuitesUnavailable, suitesDir)
	}

	sl := &SuiteLoader{}
	err = filepath.Walk(suitesDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if info.IsDir() || filepath.Ext(path) != ".json" {
			return nil
		}

		rel, err := filepath.Rel(suitesDir, path)
		if err != nil {
			return err
		}
		parts := strings.Split(rel, string(filepath.Separator))
		if len(parts) < 2 || !strings.HasPrefix(parts[0], "level-") {
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}

		var test TestDefinition
		if err := json.Unmarshal(data, &test); err != nil {
			return fmt.Errorf("parse %s: %w", path, err)
		}
		if test.ID == "" || len(test.Steps) == 0 {
			return fmt.Errorf("parse %s: missing test_id or steps", path)
		}

		var inferredLevel int
		if _, err := fmt.Sscanf(parts[0], "level-%d", &inferredLevel); err == nil {
			test.Level = inferredLevel
		}
		sl.tests = append(sl.tests, test)
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(sl.tests) == 0 {
		return nil, fmt.Errorf("%w: no core level tests found in %s", ErrSuitesUnavailable, suitesDir)
	}

	sort.Slice(sl.tests, func(i, j int) bool {
		if sl.tests[i].Level != sl.tests[j].Level {
			return sl.tests[i].Level < sl.tests[j].Level
		}
		return sl.tests[i].ID < sl.tests[j].ID
	})
	return sl, nil
}

// GetTests returns immutable copies of tests at or below the requested level.
func (sl *SuiteLoader) GetTests(level int) []TestDefinition {
	result := make([]TestDefinition, 0)
	for _, test := range sl.tests {
		if test.Level <= level {
			clone := test
			clone.Steps = append([]TestStep(nil), test.Steps...)
			result = append(result, clone)
		}
	}
	return result
}

func (sl *SuiteLoader) CountForLevel(level int) int {
	count := 0
	for _, test := range sl.tests {
		if test.Level <= level {
			count++
		}
	}
	return count
}

// Count returns the total number of loaded tests.
func (sl *SuiteLoader) Count() int {
	return len(sl.tests)
}
