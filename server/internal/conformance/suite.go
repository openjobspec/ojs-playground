package conformance

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// TestDefinition represents a conformance test case.
type TestDefinition struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Level       int        `json:"level"`
	Category    string     `json:"category"`
	Steps       []TestStep `json:"steps"`
}

// TestStep represents a single HTTP step in a test.
type TestStep struct {
	ID           string         `json:"id"`
	Method       string         `json:"method"`
	Path         string         `json:"path"`
	Body         string         `json:"body,omitempty"`
	ExpectStatus int            `json:"expect_status,omitempty"`
	ExpectBody   map[string]any `json:"expect_body,omitempty"`
	DelayMs      int            `json:"delay_ms,omitempty"`
}

// SuiteLoader loads test definitions from disk or embedded data.
type SuiteLoader struct {
	tests []TestDefinition
}

// NewSuiteLoader creates a new suite loader from the given directory.
func NewSuiteLoader(suitesDir string) (*SuiteLoader, error) {
	sl := &SuiteLoader{}

	if suitesDir == "" {
		// Return empty loader if no suites directory
		return sl, nil
	}

	if _, err := os.Stat(suitesDir); os.IsNotExist(err) {
		return sl, nil
	}

	err := filepath.Walk(suitesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || !strings.HasSuffix(path, ".json") {
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

		// Infer level from directory name
		rel, _ := filepath.Rel(suitesDir, path)
		parts := strings.Split(rel, string(filepath.Separator))
		if len(parts) > 0 {
			dirName := parts[0]
			if strings.HasPrefix(dirName, "level-") {
				fmt.Sscanf(dirName, "level-%d", &test.Level)
			}
		}

		sl.tests = append(sl.tests, test)
		return nil
	})

	if err != nil {
		return nil, err
	}

	sort.Slice(sl.tests, func(i, j int) bool {
		if sl.tests[i].Level != sl.tests[j].Level {
			return sl.tests[i].Level < sl.tests[j].Level
		}
		return sl.tests[i].ID < sl.tests[j].ID
	})

	return sl, nil
}

// GetTests returns tests filtered by level (all tests at or below the given level).
func (sl *SuiteLoader) GetTests(level int) []TestDefinition {
	var result []TestDefinition
	for _, t := range sl.tests {
		if t.Level <= level {
			result = append(result, t)
		}
	}
	return result
}

// Count returns the total number of loaded tests.
func (sl *SuiteLoader) Count() int {
	return len(sl.tests)
}
