package conformance

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Report represents a conformance test report.
type Report struct {
	Run     *RunResult         `json:"run"`
	Summary *ReportSummary     `json:"summary"`
	Levels  map[int]*LevelSummary `json:"levels"`
}

// ReportSummary is the top-level summary.
type ReportSummary struct {
	Total      int     `json:"total"`
	Passed     int     `json:"passed"`
	Failed     int     `json:"failed"`
	Skipped    int     `json:"skipped"`
	PassRate   float64 `json:"pass_rate"`
	MaxLevel   int     `json:"max_conformance_level"`
}

// LevelSummary summarizes results for a conformance level.
type LevelSummary struct {
	Level   int  `json:"level"`
	Total   int  `json:"total"`
	Passed  int  `json:"passed"`
	Failed  int  `json:"failed"`
	Conform bool `json:"conformant"`
}

// GenerateReport creates a report from run results.
func GenerateReport(result *RunResult) *Report {
	report := &Report{
		Run:    result,
		Levels: make(map[int]*LevelSummary),
	}

	// Build level summaries
	for _, test := range result.Tests {
		ls, ok := report.Levels[test.Level]
		if !ok {
			ls = &LevelSummary{Level: test.Level}
			report.Levels[test.Level] = ls
		}
		ls.Total++
		if test.Status == "passed" {
			ls.Passed++
		} else if test.Status == "failed" {
			ls.Failed++
		}
	}

	// Determine conformance per level
	maxLevel := -1
	for level, ls := range report.Levels {
		ls.Conform = ls.Failed == 0 && ls.Total > 0
		if ls.Conform && level > maxLevel {
			maxLevel = level
		}
	}

	// Build summary
	passRate := 0.0
	if result.Total > 0 {
		passRate = float64(result.Passed) / float64(result.Total) * 100
	}
	report.Summary = &ReportSummary{
		Total:    result.Total,
		Passed:   result.Passed,
		Failed:   result.Failed,
		Skipped:  result.Skipped,
		PassRate: passRate,
		MaxLevel: maxLevel,
	}

	return report
}

// ToJSON renders the report as JSON.
func (r *Report) ToJSON() ([]byte, error) {
	return json.MarshalIndent(r, "", "  ")
}

// ToMarkdown renders the report as Markdown.
func (r *Report) ToMarkdown() string {
	var sb strings.Builder

	sb.WriteString("# OJS Conformance Report\n\n")
	sb.WriteString(fmt.Sprintf("**Status:** %s\n", r.Run.Status))
	sb.WriteString(fmt.Sprintf("**Max Conformance Level:** %d\n", r.Summary.MaxLevel))
	sb.WriteString(fmt.Sprintf("**Pass Rate:** %.1f%% (%d/%d)\n\n", r.Summary.PassRate, r.Summary.Passed, r.Summary.Total))

	sb.WriteString("## Level Summary\n\n")
	sb.WriteString("| Level | Total | Passed | Failed | Conformant |\n")
	sb.WriteString("|-------|-------|--------|--------|------------|\n")

	for level := 0; level <= 4; level++ {
		ls, ok := r.Levels[level]
		if !ok {
			continue
		}
		conform := "No"
		if ls.Conform {
			conform = "Yes"
		}
		sb.WriteString(fmt.Sprintf("| %d | %d | %d | %d | %s |\n",
			level, ls.Total, ls.Passed, ls.Failed, conform))
	}

	if r.Run.Failed > 0 {
		sb.WriteString("\n## Failed Tests\n\n")
		for _, test := range r.Run.Tests {
			if test.Status == "failed" {
				sb.WriteString(fmt.Sprintf("- **%s** (%s): %s\n", test.ID, test.Name, test.Error))
			}
		}
	}

	return sb.String()
}
