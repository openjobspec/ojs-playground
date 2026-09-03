package conformance

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestSuiteLoaderReadsCurrentConformanceFormat(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "level-0-core", "operations")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	fixture := `{
	  "test_id": "L0-TEST-001",
	  "level": 0,
	  "category": "operations",
	  "name": "health",
	  "steps": [{
	    "id": "step-1",
	    "action": "GET",
	    "path": "/ojs/v1/health",
	    "assertions": {"status": 200, "body": {"$.status": {"$in": ["ok"]}}}
	  }]
	}`
	if err := os.WriteFile(filepath.Join(dir, "health.json"), []byte(fixture), 0o600); err != nil {
		t.Fatal(err)
	}

	loader, err := NewSuiteLoader(root)
	if err != nil {
		t.Fatal(err)
	}
	if loader.Count() != 1 || loader.CountForLevel(0) != 1 {
		t.Fatalf("unexpected suite counts: total=%d level0=%d", loader.Count(), loader.CountForLevel(0))
	}
	test := loader.GetTests(0)[0]
	if test.ID != "L0-TEST-001" || test.Steps[0].HTTPMethod() != "GET" {
		t.Fatalf("current suite fields were not decoded: %+v", test)
	}
}

func TestSuiteLoaderUnavailableIsAnError(t *testing.T) {
	_, err := NewSuiteLoader(filepath.Join(t.TempDir(), "missing"))
	if !errors.Is(err, ErrSuitesUnavailable) {
		t.Fatalf("expected ErrSuitesUnavailable, got %v", err)
	}
}

func TestRunnerNeverCompletesWithZeroTests(t *testing.T) {
	runner := NewRunner("http://127.0.0.1", &SuiteLoader{}, nil)
	result := runner.Run(context.Background(), "run-zero", 0)
	if result.Status != "failed" || result.Total != 0 || result.Error == "" {
		t.Fatalf("zero-test run must fail explicitly: %+v", result)
	}
}

func TestSuiteLoaderReadsWorkspaceSuitesRoot(t *testing.T) {
	root := filepath.Clean("../../../../ojs-conformance/suites")
	if _, err := os.Stat(root); err != nil {
		t.Skip("workspace conformance repository is not present")
	}
	loader, err := NewSuiteLoader(root)
	if err != nil {
		t.Fatalf("load actual suites root: %v", err)
	}
	if loader.CountForLevel(0) == 0 || loader.CountForLevel(4) <= loader.CountForLevel(0) {
		t.Fatalf("unexpected actual suite counts: L0=%d L4=%d", loader.CountForLevel(0), loader.CountForLevel(4))
	}
}
