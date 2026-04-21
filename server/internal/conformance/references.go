package conformance

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

var (
	referencePattern      = regexp.MustCompile(`\{\{([^{}]+)\}\}`)
	exactReferencePattern = regexp.MustCompile(`^\{\{([^{}]+)\}\}$`)
)

type stepResponse struct {
	Status      int
	Headers     http.Header
	Body        any
	BodyDecoded bool
}

type testExecutionContext struct {
	steps    map[string]*stepResponse
	captures map[string]any
}

func newTestExecutionContext() *testExecutionContext {
	return &testExecutionContext{
		steps:    make(map[string]*stepResponse),
		captures: make(map[string]any),
	}
}

func (c *testExecutionContext) snapshot() *testExecutionContext {
	clone := newTestExecutionContext()
	for id, response := range c.steps {
		clone.steps[id] = response
	}
	for name, value := range c.captures {
		clone.captures[name] = value
	}
	return clone
}

func (c *testExecutionContext) store(stepID string, response *stepResponse, captures map[string]any) error {
	if _, exists := c.steps[stepID]; exists {
		return runnerErrorf("duplicate conformance step id %q", stepID)
	}
	c.steps[stepID] = response
	for name, value := range captures {
		if _, exists := c.captures[name]; exists {
			return runnerErrorf("duplicate conformance capture %q", name)
		}
		c.captures[name] = value
	}
	return nil
}

func (c *testExecutionContext) syntheticValue() map[string]any {
	steps := make(map[string]any, len(c.steps))
	for id, response := range c.steps {
		headers := make(map[string]any, len(response.Headers))
		for name, values := range response.Headers {
			if len(values) == 1 {
				headers[name] = values[0]
			} else {
				headers[name] = append([]string(nil), values...)
			}
		}
		steps[id] = map[string]any{
			"response": map[string]any{
				"status":  response.Status,
				"headers": headers,
				"body":    response.Body,
			},
		}
	}
	return map[string]any{
		"steps":    steps,
		"captures": c.captures,
	}
}

func resolveValue(value any, execution *testExecutionContext) (any, error) {
	switch typed := value.(type) {
	case string:
		if match := exactReferencePattern.FindStringSubmatch(typed); match != nil {
			return resolveReference(match[1], execution)
		}
		return resolveText(typed, execution)
	case []any:
		resolved := make([]any, len(typed))
		for index, item := range typed {
			value, err := resolveValue(item, execution)
			if err != nil {
				return nil, err
			}
			resolved[index] = value
		}
		return resolved, nil
	case map[string]any:
		resolved := make(map[string]any, len(typed))
		for key, item := range typed {
			value, err := resolveValue(item, execution)
			if err != nil {
				return nil, err
			}
			resolved[key] = value
		}
		return resolved, nil
	default:
		return value, nil
	}
}

func resolveText(input string, execution *testExecutionContext) (string, error) {
	var resolutionError error
	resolved := referencePattern.ReplaceAllStringFunc(input, func(placeholder string) string {
		if resolutionError != nil {
			return placeholder
		}
		match := exactReferencePattern.FindStringSubmatch(placeholder)
		value, err := resolveReference(match[1], execution)
		if err != nil {
			resolutionError = err
			return placeholder
		}
		text, err := referenceText(value)
		if err != nil {
			resolutionError = err
			return placeholder
		}
		return text
	})
	if resolutionError != nil {
		return "", resolutionError
	}
	if strings.Contains(resolved, "{{") || strings.Contains(resolved, "}}") {
		return "", runnerErrorf("unknown or malformed conformance reference in %q", input)
	}
	return resolved, nil
}

func resolveReference(expression string, execution *testExecutionContext) (any, error) {
	expression = strings.TrimSpace(expression)
	if strings.HasPrefix(expression, "captures.") {
		name := strings.TrimPrefix(expression, "captures.")
		if name == "" || strings.Contains(name, ".") {
			return nil, runnerErrorf("unknown conformance reference %q", expression)
		}
		value, ok := execution.captures[name]
		if !ok {
			return nil, runnerErrorf("unknown conformance capture %q", name)
		}
		return value, nil
	}
	if !strings.HasPrefix(expression, "steps.") {
		return nil, runnerErrorf("unknown conformance reference %q", expression)
	}

	remainder := strings.TrimPrefix(expression, "steps.")
	separator := strings.Index(remainder, ".response.")
	if separator <= 0 {
		return nil, runnerErrorf("unknown conformance reference %q", expression)
	}
	stepID := remainder[:separator]
	target := remainder[separator+len(".response."):]
	response, ok := execution.steps[stepID]
	if !ok {
		return nil, runnerErrorf("reference %q uses unknown or later step %q", expression, stepID)
	}

	switch {
	case target == "status":
		return response.Status, nil
	case target == "headers":
		headers := make(map[string]any, len(response.Headers))
		for name, values := range response.Headers {
			if len(values) == 1 {
				headers[name] = values[0]
			} else {
				headers[name] = append([]string(nil), values...)
			}
		}
		return headers, nil
	case strings.HasPrefix(target, "headers."):
		name := strings.TrimPrefix(target, "headers.")
		if name == "" {
			return nil, runnerErrorf("unknown conformance reference %q", expression)
		}
		value := response.Headers.Get(name)
		if value == "" {
			return nil, fmt.Errorf("reference %q could not resolve response header %q", expression, name)
		}
		return value, nil
	case target == "body":
		if !response.BodyDecoded {
			return nil, fmt.Errorf("reference %q requires a JSON response body", expression)
		}
		return response.Body, nil
	case strings.HasPrefix(target, "body.") || strings.HasPrefix(target, "body["):
		if !response.BodyDecoded {
			return nil, fmt.Errorf("reference %q requires a JSON response body", expression)
		}
		path := "$" + strings.TrimPrefix(target, "body")
		value, exists, err := lookupJSONPath(response.Body, path)
		if err != nil {
			return nil, fmt.Errorf("reference %q: %w", expression, err)
		}
		if !exists {
			return nil, fmt.Errorf("reference %q could not resolve JSON path %q", expression, path)
		}
		return value, nil
	default:
		return nil, runnerErrorf("unknown conformance response reference %q", expression)
	}
}

func referenceText(value any) (string, error) {
	switch typed := value.(type) {
	case string:
		return typed, nil
	case nil:
		return "null", nil
	case bool:
		return strconv.FormatBool(typed), nil
	case int:
		return strconv.Itoa(typed), nil
	case int64:
		return strconv.FormatInt(typed, 10), nil
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64), nil
	default:
		encoded, err := json.Marshal(value)
		if err != nil {
			return "", runnerErrorf("reference value of type %T cannot be interpolated", value)
		}
		return string(encoded), nil
	}
}

type jsonPathToken struct {
	kind  string
	key   string
	index int
	value string
}

func lookupJSONPath(value any, path string) (any, bool, error) {
	tokens, err := parseJSONPath(path)
	if err != nil {
		return nil, false, err
	}
	return evaluateJSONPath(value, tokens, 0)
}

func parseJSONPath(path string) ([]jsonPathToken, error) {
	if path == "$" || path == "" {
		return nil, nil
	}
	if strings.HasPrefix(path, "$.") {
		path = path[2:]
	} else if strings.HasPrefix(path, "$[") {
		path = path[1:]
	} else if strings.HasPrefix(path, "$") {
		return nil, runnerErrorf("invalid JSONPath %q", path)
	}

	var tokens []jsonPathToken
	for index := 0; index < len(path); {
		switch path[index] {
		case '.':
			index++
			if index >= len(path) {
				return nil, runnerErrorf("invalid JSONPath with trailing dot")
			}
		case '[':
			end := strings.IndexByte(path[index:], ']')
			if end < 0 {
				return nil, runnerErrorf("invalid JSONPath %q: unclosed bracket", path)
			}
			end += index
			content := path[index+1 : end]
			switch {
			case content == "*":
				tokens = append(tokens, jsonPathToken{kind: "wildcard"})
			case strings.HasPrefix(content, "?(@.") && strings.HasSuffix(content, ")"):
				filter, err := parseJSONPathFilter(content)
				if err != nil {
					return nil, err
				}
				tokens = append(tokens, filter)
			default:
				arrayIndex, err := strconv.Atoi(content)
				if err != nil || arrayIndex < 0 {
					return nil, runnerErrorf("invalid JSONPath array index %q", content)
				}
				tokens = append(tokens, jsonPathToken{kind: "index", index: arrayIndex})
			}
			index = end + 1
		default:
			end := index
			for end < len(path) && path[end] != '.' && path[end] != '[' {
				end++
			}
			if end == index {
				return nil, runnerErrorf("invalid JSONPath %q", path)
			}
			tokens = append(tokens, jsonPathToken{kind: "key", key: path[index:end]})
			index = end
		}
	}
	return tokens, nil
}

func parseJSONPathFilter(content string) (jsonPathToken, error) {
	expression := strings.TrimSuffix(strings.TrimPrefix(content, "?(@."), ")")
	separator := strings.Index(expression, "==")
	if separator <= 0 {
		return jsonPathToken{}, runnerErrorf("unsupported JSONPath filter %q", content)
	}
	key := strings.TrimSpace(expression[:separator])
	value := strings.TrimSpace(expression[separator+2:])
	if key == "" || value == "" {
		return jsonPathToken{}, runnerErrorf("invalid JSONPath filter %q", content)
	}
	if (value[0] == '\'' && value[len(value)-1] == '\'') ||
		(value[0] == '"' && value[len(value)-1] == '"') {
		value = value[1 : len(value)-1]
	}
	return jsonPathToken{kind: "filter", key: key, value: value}, nil
}

func evaluateJSONPath(current any, tokens []jsonPathToken, index int) (any, bool, error) {
	if index >= len(tokens) {
		return current, true, nil
	}
	token := tokens[index]
	switch token.kind {
	case "key":
		object, ok := current.(map[string]any)
		if !ok {
			return nil, false, fmt.Errorf("expected object before field %q, got %T", token.key, current)
		}
		value, exists := object[token.key]
		if !exists {
			return nil, false, nil
		}
		return evaluateJSONPath(value, tokens, index+1)
	case "index":
		array, ok := current.([]any)
		if !ok {
			return nil, false, fmt.Errorf("expected array before index %d, got %T", token.index, current)
		}
		if token.index >= len(array) {
			return nil, false, nil
		}
		return evaluateJSONPath(array[token.index], tokens, index+1)
	case "wildcard":
		array, ok := current.([]any)
		if !ok {
			return nil, false, fmt.Errorf("expected array before wildcard, got %T", current)
		}
		values := make([]any, 0, len(array))
		for _, item := range array {
			value, exists, err := evaluateJSONPath(item, tokens, index+1)
			if err != nil {
				return nil, false, err
			}
			if exists {
				values = append(values, value)
			}
		}
		return values, true, nil
	case "filter":
		array, ok := current.([]any)
		if !ok {
			return nil, false, fmt.Errorf("expected array before filter, got %T", current)
		}
		filterTokens, err := parseJSONPath(token.key)
		if err != nil {
			return nil, false, err
		}
		for _, item := range array {
			value, exists, err := evaluateJSONPath(item, filterTokens, 0)
			if err != nil || !exists {
				continue
			}
			text, err := referenceText(value)
			if err == nil && text == token.value {
				return evaluateJSONPath(item, tokens, index+1)
			}
		}
		return nil, false, nil
	default:
		return nil, false, runnerErrorf("unsupported JSONPath token %q", token.kind)
	}
}
