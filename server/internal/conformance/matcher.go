package conformance

import (
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const approximateTolerancePercent = 50

var (
	uuidPattern        = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	uuidV7Pattern      = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	numberRangePattern = regexp.MustCompile(`^number:range\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)$`)
	arrayLengthPattern = regexp.MustCompile(`^array:length\((\d+)\)$`)
	approximatePattern = regexp.MustCompile(`^~(-?\d+(?:\.\d+)?)$`)
)

func assertValue(actual any, exists bool, expected any) error {
	switch typed := expected.(type) {
	case nil:
		if !exists || actual != nil {
			return fmt.Errorf("expected null, got %v", actual)
		}
		return nil
	case string:
		return assertStringMatcher(actual, exists, typed)
	case float64:
		return assertNumberEqual(actual, exists, typed)
	case int:
		return assertNumberEqual(actual, exists, float64(typed))
	case int64:
		return assertNumberEqual(actual, exists, float64(typed))
	case bool:
		if !exists {
			return fmt.Errorf("expected %t, but value was absent", typed)
		}
		actualBool, ok := actual.(bool)
		if !ok || actualBool != typed {
			return fmt.Errorf("expected %t, got %v", typed, actual)
		}
		return nil
	case []any:
		if !exists {
			return fmt.Errorf("expected array, but value was absent")
		}
		actualArray, ok := actual.([]any)
		if !ok {
			return fmt.Errorf("expected array, got %T", actual)
		}
		if len(actualArray) != len(typed) {
			return fmt.Errorf("expected array length %d, got %d", len(typed), len(actualArray))
		}
		for index, item := range typed {
			if err := assertValue(actualArray[index], true, item); err != nil {
				return fmt.Errorf("[%d]: %w", index, err)
			}
		}
		return nil
	case map[string]any:
		return assertObjectMatcher(actual, exists, typed)
	default:
		return runnerErrorf("unsupported matcher value of type %T", expected)
	}
}

func assertStringMatcher(actual any, exists bool, matcher string) error {
	switch matcher {
	case "any", "exists":
		if !exists {
			return fmt.Errorf("expected value to exist")
		}
		return nil
	case "absent":
		if exists {
			return fmt.Errorf("expected value to be absent, got %v", actual)
		}
		return nil
	case "string:nonempty", "string:non_empty":
		value, ok := actual.(string)
		if !exists || !ok || value == "" {
			return fmt.Errorf("expected non-empty string, got %v", actual)
		}
		return nil
	case "string:any":
		if !exists {
			return fmt.Errorf("expected string, but value was absent")
		}
		if _, ok := actual.(string); !ok {
			return fmt.Errorf("expected string, got %T", actual)
		}
		return nil
	case "string:uuid":
		return assertStringPattern(actual, exists, "UUID", uuidPattern)
	case "string:uuidv7":
		return assertStringPattern(actual, exists, "UUIDv7", uuidV7Pattern)
	case "string:datetime":
		value, ok := actual.(string)
		if !exists || !ok {
			return fmt.Errorf("expected RFC 3339 datetime string, got %v", actual)
		}
		if _, err := time.Parse(time.RFC3339, value); err != nil {
			return fmt.Errorf("expected RFC 3339 datetime, got %q", value)
		}
		return nil
	case "number:positive":
		return assertNumberPredicate(actual, exists, "positive number", func(value float64) bool { return value > 0 })
	case "number:non_negative":
		return assertNumberPredicate(actual, exists, "non-negative number", func(value float64) bool { return value >= 0 })
	case "number:any":
		return assertNumberPredicate(actual, exists, "number", func(float64) bool { return true })
	case "number:integer":
		return assertNumberPredicate(actual, exists, "integer", func(value float64) bool { return value == math.Trunc(value) })
	case "boolean:any":
		if !exists {
			return fmt.Errorf("expected boolean, but value was absent")
		}
		if _, ok := actual.(bool); !ok {
			return fmt.Errorf("expected boolean, got %T", actual)
		}
		return nil
	case "boolean:true", "boolean:false":
		if !exists {
			return fmt.Errorf("expected %s, but value was absent", strings.TrimPrefix(matcher, "boolean:"))
		}
		want := matcher == "boolean:true"
		got, ok := actual.(bool)
		if !ok || got != want {
			return fmt.Errorf("expected %t, got %v", want, actual)
		}
		return nil
	case "array:any":
		if !exists {
			return fmt.Errorf("expected array, but value was absent")
		}
		if _, ok := actual.([]any); !ok {
			return fmt.Errorf("expected array, got %T", actual)
		}
		return nil
	case "array:nonempty":
		return assertArrayLength(actual, exists, "at least", 1)
	case "array:empty":
		return assertArrayLength(actual, exists, "exactly", 0)
	case "object:any":
		if !exists {
			return fmt.Errorf("expected object, but value was absent")
		}
		if _, ok := actual.(map[string]any); !ok {
			return fmt.Errorf("expected object, got %T", actual)
		}
		return nil
	case "object:nonempty":
		value, ok := actual.(map[string]any)
		if !exists || !ok || len(value) == 0 {
			return fmt.Errorf("expected non-empty object, got %v", actual)
		}
		return nil
	case "object:empty":
		value, ok := actual.(map[string]any)
		if !exists || !ok || len(value) != 0 {
			return fmt.Errorf("expected empty object, got %v", actual)
		}
		return nil
	}

	for prefix, mode := range map[string]string{
		"array:min_length:": "at least",
		"array:min:":        "at least",
		"array:length:":     "exactly",
	} {
		if strings.HasPrefix(matcher, prefix) {
			length, err := strconv.Atoi(strings.TrimPrefix(matcher, prefix))
			if err != nil || length < 0 {
				return runnerErrorf("invalid matcher %q", matcher)
			}
			return assertArrayLength(actual, exists, mode, length)
		}
	}

	if strings.HasPrefix(matcher, "string:contains:") {
		needle := strings.TrimPrefix(matcher, "string:contains:")
		value, ok := actual.(string)
		if !exists || !ok {
			return fmt.Errorf("expected string containing %q, got %v", needle, actual)
		}
		if !strings.Contains(value, needle) {
			return fmt.Errorf("expected string containing %q, got %q", needle, value)
		}
		return nil
	}

	if strings.HasPrefix(matcher, "string:pattern(") && strings.HasSuffix(matcher, ")") {
		pattern := matcher[len("string:pattern(") : len(matcher)-1]
		expression, err := regexp.Compile(pattern)
		if err != nil {
			return runnerErrorf("invalid matcher %q: %v", matcher, err)
		}
		return assertStringPattern(actual, exists, "matching string", expression)
	}

	if matches := numberRangePattern.FindStringSubmatch(matcher); matches != nil {
		lower, _ := strconv.ParseFloat(matches[1], 64)
		upper, _ := strconv.ParseFloat(matches[2], 64)
		if lower > upper {
			return runnerErrorf("invalid matcher %q: lower bound exceeds upper bound", matcher)
		}
		return assertNumberPredicate(actual, exists, fmt.Sprintf("number in range [%v, %v]", lower, upper), func(value float64) bool {
			return value >= lower && value <= upper
		})
	}

	if matches := arrayLengthPattern.FindStringSubmatch(matcher); matches != nil {
		length, _ := strconv.Atoi(matches[1])
		return assertArrayLength(actual, exists, "exactly", length)
	}

	if matches := approximatePattern.FindStringSubmatch(matcher); matches != nil {
		expected, _ := strconv.ParseFloat(matches[1], 64)
		actualNumber, ok := asFloat(actual)
		if !exists || !ok {
			return fmt.Errorf("expected approximate number %v, got %v", expected, actual)
		}
		tolerance := math.Abs(expected) * approximateTolerancePercent / 100
		if tolerance == 0 {
			tolerance = 0.5
		}
		if math.Abs(actualNumber-expected) > tolerance {
			return fmt.Errorf("expected ~%v (±%v), got %v", expected, tolerance, actualNumber)
		}
		return nil
	}

	for _, prefix := range []string{"string:", "number:", "boolean:", "array:", "object:"} {
		if strings.HasPrefix(matcher, prefix) {
			return runnerErrorf("unsupported matcher %q", matcher)
		}
	}

	if strings.HasPrefix(matcher, "contains:") || strings.HasPrefix(matcher, "not_contains:") {
		array, ok := actual.([]any)
		if !exists || !ok {
			return fmt.Errorf("expected array for matcher %q, got %v", matcher, actual)
		}
		needle := strings.TrimPrefix(strings.TrimPrefix(matcher, "contains:"), "not_contains:")
		found := false
		for _, value := range array {
			if fmt.Sprint(value) == needle {
				found = true
				break
			}
		}
		if strings.HasPrefix(matcher, "contains:") && !found {
			return fmt.Errorf("expected array to contain %q", needle)
		}
		if strings.HasPrefix(matcher, "not_contains:") && found {
			return fmt.Errorf("expected array not to contain %q", needle)
		}
		return nil
	}

	if !exists {
		return fmt.Errorf("expected %q, but value was absent", matcher)
	}
	value, ok := actual.(string)
	if !ok || value != matcher {
		return fmt.Errorf("expected %q, got %v", matcher, actual)
	}
	return nil
}

func assertObjectMatcher(actual any, exists bool, matcher map[string]any) error {
	hasOperator := false
	for key := range matcher {
		if strings.HasPrefix(key, "$") {
			hasOperator = true
			break
		}
	}
	if !hasOperator {
		if !exists {
			return fmt.Errorf("expected object, but value was absent")
		}
		object, ok := actual.(map[string]any)
		if !ok {
			return fmt.Errorf("expected object, got %T", actual)
		}
		for key, expected := range matcher {
			value, present := object[key]
			if err := assertValue(value, present, expected); err != nil {
				return fmt.Errorf("%s: %w", key, err)
			}
		}
		return nil
	}

	for key := range matcher {
		switch key {
		case "$exists", "$type", "$match", "$in", "$size", "$or", "$empty",
			"$gte", "$lte", "$gt", "$lt", "$contains", "$eq":
		default:
			if strings.HasPrefix(key, "$") {
				return runnerErrorf("unsupported matcher operator %q", key)
			}
			return runnerErrorf("matcher object mixes operator %q with field %q", firstOperator(matcher), key)
		}
	}

	if expectedExists, ok := matcher["$exists"]; ok {
		want, ok := expectedExists.(bool)
		if !ok {
			return runnerErrorf("$exists requires a boolean, got %T", expectedExists)
		}
		if want != exists {
			return fmt.Errorf("expected existence %t, got %t", want, exists)
		}
		if !want {
			return nil
		}
	}
	if !exists {
		return fmt.Errorf("expected value to exist")
	}

	for operator, expected := range matcher {
		switch operator {
		case "$exists":
			continue
		case "$type":
			expectedType, ok := expected.(string)
			if !ok {
				return runnerErrorf("$type requires a string, got %T", expected)
			}
			switch expectedType {
			case "string", "number", "integer", "boolean", "array", "object", "null":
			default:
				return runnerErrorf("unsupported $type matcher %q", expectedType)
			}
			if !matchesJSONType(actual, expectedType) {
				return fmt.Errorf("expected type %s, got %T", expectedType, actual)
			}
		case "$match":
			pattern, ok := expected.(string)
			if !ok {
				return runnerErrorf("$match requires a string, got %T", expected)
			}
			expression, err := regexp.Compile(pattern)
			if err != nil {
				return runnerErrorf("invalid $match pattern %q: %v", pattern, err)
			}
			value, ok := actual.(string)
			if !ok || !expression.MatchString(value) {
				return fmt.Errorf("expected %v to match %q", actual, pattern)
			}
		case "$in":
			alternatives, ok := expected.([]any)
			if !ok {
				return runnerErrorf("$in requires an array, got %T", expected)
			}
			var semanticError error
			for _, alternative := range alternatives {
				err := assertValue(actual, true, alternative)
				if err == nil {
					semanticError = nil
					break
				}
				if isRunnerSemanticError(err) {
					semanticError = err
				}
			}
			if semanticError != nil {
				return semanticError
			}
			matched := false
			for _, alternative := range alternatives {
				if assertValue(actual, true, alternative) == nil {
					matched = true
					break
				}
			}
			if !matched {
				return fmt.Errorf("expected one of %v, got %v", alternatives, actual)
			}
		case "$size":
			length, ok := valueLength(actual)
			if !ok {
				return fmt.Errorf("value of type %T has no length", actual)
			}
			if err := assertValue(float64(length), true, expected); err != nil {
				return fmt.Errorf("length: %w", err)
			}
		case "$or":
			alternatives, ok := expected.([]any)
			if !ok || len(alternatives) == 0 {
				return runnerErrorf("$or requires a non-empty array")
			}
			var semanticError error
			for _, alternative := range alternatives {
				err := assertValue(actual, true, alternative)
				if err == nil {
					return nil
				}
				if isRunnerSemanticError(err) {
					semanticError = err
				}
			}
			if semanticError != nil {
				return semanticError
			}
			return fmt.Errorf("value %v did not match any $or alternative", actual)
		case "$empty":
			want, ok := expected.(bool)
			if !ok {
				return runnerErrorf("$empty requires a boolean, got %T", expected)
			}
			empty := isEmptyValue(actual)
			if empty != want {
				return fmt.Errorf("expected empty=%t, got %v", want, actual)
			}
		case "$gte", "$lte", "$gt", "$lt":
			actualNumber, actualOK := asFloat(actual)
			expectedNumber, expectedOK := asFloat(expected)
			if !actualOK || !expectedOK {
				return fmt.Errorf("%s requires numbers, got %v and %v", operator, actual, expected)
			}
			passed := map[string]bool{
				"$gte": actualNumber >= expectedNumber,
				"$lte": actualNumber <= expectedNumber,
				"$gt":  actualNumber > expectedNumber,
				"$lt":  actualNumber < expectedNumber,
			}[operator]
			if !passed {
				return fmt.Errorf("expected %v %s %v", actualNumber, operator, expectedNumber)
			}
		case "$contains":
			if !containsValue(actual, expected) {
				return fmt.Errorf("expected %v to contain %v", actual, expected)
			}
		case "$eq":
			if !jsonValuesEqual(actual, expected) {
				return fmt.Errorf("expected %v, got %v", expected, actual)
			}
		}
	}
	return nil
}

func firstOperator(matcher map[string]any) string {
	for key := range matcher {
		if strings.HasPrefix(key, "$") {
			return key
		}
	}
	return ""
}

func assertStringPattern(actual any, exists bool, label string, pattern *regexp.Regexp) error {
	value, ok := actual.(string)
	if !exists || !ok || !pattern.MatchString(value) {
		return fmt.Errorf("expected %s, got %v", label, actual)
	}
	return nil
}

func assertNumberPredicate(actual any, exists bool, label string, predicate func(float64) bool) error {
	value, ok := asFloat(actual)
	if !exists || !ok || !predicate(value) {
		return fmt.Errorf("expected %s, got %v", label, actual)
	}
	return nil
}

func assertArrayLength(actual any, exists bool, mode string, expected int) error {
	array, ok := actual.([]any)
	if !exists || !ok {
		return fmt.Errorf("expected array with %s %d items, got %v", mode, expected, actual)
	}
	passed := len(array) == expected
	if mode == "at least" {
		passed = len(array) >= expected
	}
	if !passed {
		return fmt.Errorf("expected array with %s %d items, got %d", mode, expected, len(array))
	}
	return nil
}

func assertNumberEqual(actual any, exists bool, expected float64) error {
	value, ok := asFloat(actual)
	if !exists || !ok || math.Abs(value-expected) > 1e-9 {
		return fmt.Errorf("expected %v, got %v", expected, actual)
	}
	return nil
}

func asFloat(value any) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, true
	case float32:
		return float64(number), true
	case int:
		return float64(number), true
	case int32:
		return float64(number), true
	case int64:
		return float64(number), true
	default:
		return 0, false
	}
}

func matchesJSONType(value any, expected string) bool {
	switch expected {
	case "string":
		_, ok := value.(string)
		return ok
	case "number":
		_, ok := asFloat(value)
		return ok
	case "integer":
		number, ok := asFloat(value)
		return ok && number == math.Trunc(number)
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "array":
		_, ok := value.([]any)
		return ok
	case "object":
		_, ok := value.(map[string]any)
		return ok
	case "null":
		return value == nil
	default:
		return false
	}
}

func valueLength(value any) (int, bool) {
	switch typed := value.(type) {
	case string:
		return len(typed), true
	case []any:
		return len(typed), true
	case map[string]any:
		return len(typed), true
	default:
		return 0, false
	}
}

func isEmptyValue(value any) bool {
	if value == nil {
		return true
	}
	length, ok := valueLength(value)
	return ok && length == 0
}

func containsValue(actual, expected any) bool {
	switch typed := actual.(type) {
	case string:
		return strings.Contains(typed, fmt.Sprint(expected))
	case []any:
		for _, value := range typed {
			if jsonValuesEqual(value, expected) {
				return true
			}
		}
	case map[string]any:
		_, ok := typed[fmt.Sprint(expected)]
		return ok
	}
	return false
}

func jsonValuesEqual(left, right any) bool {
	leftNumber, leftIsNumber := asFloat(left)
	rightNumber, rightIsNumber := asFloat(right)
	if leftIsNumber || rightIsNumber {
		return leftIsNumber && rightIsNumber && math.Abs(leftNumber-rightNumber) <= 1e-9
	}
	return reflect.DeepEqual(left, right)
}
