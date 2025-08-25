package features

import (
	"context"
	"fmt"
	"reflect"
	"strconv"
	"strings"
)

// DefaultSegmentEvaluator implements the SegmentEvaluator interface
type DefaultSegmentEvaluator struct{}

// NewSegmentEvaluator creates a new segment evaluator
func NewSegmentEvaluator() *DefaultSegmentEvaluator {
	return &DefaultSegmentEvaluator{}
}

// EvaluateSegment evaluates whether a user matches a segment's conditions
func (e *DefaultSegmentEvaluator) EvaluateSegment(ctx context.Context, segment *UserSegment, evalCtx *EvaluationContext) (bool, error) {
	if len(segment.Conditions) == 0 {
		return true, nil // Empty conditions match everyone
	}

	// Evaluate all conditions (AND logic by default)
	for _, condition := range segment.Conditions {
		match, err := e.evaluateCondition(condition, evalCtx)
		if err != nil {
			return false, fmt.Errorf("failed to evaluate condition: %w", err)
		}
		if !match {
			return false, nil // If any condition fails, user is not in segment
		}
	}

	return true, nil
}

// EvaluateUserInSegments returns the keys of segments the user matches
func (e *DefaultSegmentEvaluator) EvaluateUserInSegments(ctx context.Context, segments []*UserSegment, evalCtx *EvaluationContext) ([]string, error) {
	var matchingSegments []string

	for _, segment := range segments {
		matches, err := e.EvaluateSegment(ctx, segment, evalCtx)
		if err != nil {
			continue // Skip segments with evaluation errors
		}
		if matches {
			matchingSegments = append(matchingSegments, segment.Key)
		}
	}

	return matchingSegments, nil
}

// evaluateCondition evaluates a single condition
func (e *DefaultSegmentEvaluator) evaluateCondition(condition map[string]interface{}, evalCtx *EvaluationContext) (bool, error) {
	attribute, ok := condition["attribute"].(string)
	if !ok {
		return false, fmt.Errorf("condition missing attribute field")
	}

	operator, ok := condition["operator"].(string)
	if !ok {
		return false, fmt.Errorf("condition missing operator field")
	}

	expectedValue := condition["value"]

	// Get actual value from evaluation context
	actualValue := e.getAttributeValue(attribute, evalCtx)
	if actualValue == nil {
		// Handle missing attributes based on operator
		switch operator {
		case "exists", "not_exists":
			return operator == "not_exists", nil
		default:
			return false, nil // Missing attributes don't match other operators
		}
	}

	return e.compareValues(actualValue, operator, expectedValue)
}

// getAttributeValue retrieves an attribute value from the evaluation context
func (e *DefaultSegmentEvaluator) getAttributeValue(attribute string, evalCtx *EvaluationContext) interface{} {
	// Special handling for built-in attributes
	switch attribute {
	case "user_id":
		if evalCtx.UserID != nil {
			return evalCtx.UserID.String()
		}
		return nil
	case "environment":
		return evalCtx.Environment
	default:
		// Check user attributes
		if evalCtx.UserAttributes != nil {
			if value, exists := evalCtx.UserAttributes[attribute]; exists {
				return value
			}
		}
		// Check custom context
		if evalCtx.Custom != nil {
			if value, exists := evalCtx.Custom[attribute]; exists {
				return value
			}
		}
		return nil
	}
}

// compareValues compares actual and expected values using the specified operator
func (e *DefaultSegmentEvaluator) compareValues(actual interface{}, operator string, expected interface{}) (bool, error) {
	switch operator {
	case "equals", "eq":
		return e.isEqual(actual, expected), nil
	case "not_equals", "ne":
		return !e.isEqual(actual, expected), nil
	case "in":
		return e.isIn(actual, expected), nil
	case "not_in":
		return !e.isIn(actual, expected), nil
	case "contains":
		return e.contains(actual, expected), nil
	case "not_contains":
		return !e.contains(actual, expected), nil
	case "starts_with":
		return e.startsWith(actual, expected), nil
	case "ends_with":
		return e.endsWith(actual, expected), nil
	case "regex":
		return e.matchesRegex(actual, expected), nil
	case "exists":
		return actual != nil, nil
	case "not_exists":
		return actual == nil, nil
	case "greater_than", "gt":
		return e.isGreaterThan(actual, expected), nil
	case "greater_than_or_equal", "gte":
		return e.isGreaterThanOrEqual(actual, expected), nil
	case "less_than", "lt":
		return e.isLessThan(actual, expected), nil
	case "less_than_or_equal", "lte":
		return e.isLessThanOrEqual(actual, expected), nil
	case "version_greater_than":
		return e.isVersionGreaterThan(actual, expected), nil
	case "version_less_than":
		return e.isVersionLessThan(actual, expected), nil
	default:
		return false, fmt.Errorf("unsupported operator: %s", operator)
	}
}

// Comparison helper methods

func (e *DefaultSegmentEvaluator) isEqual(actual, expected interface{}) bool {
	return reflect.DeepEqual(actual, expected)
}

func (e *DefaultSegmentEvaluator) isIn(actual, expected interface{}) bool {
	expectedSlice, ok := expected.([]interface{})
	if !ok {
		return false
	}

	for _, item := range expectedSlice {
		if e.isEqual(actual, item) {
			return true
		}
	}
	return false
}

func (e *DefaultSegmentEvaluator) contains(actual, expected interface{}) bool {
	actualStr := e.toString(actual)
	expectedStr := e.toString(expected)
	if actualStr == "" || expectedStr == "" {
		return false
	}
	return strings.Contains(actualStr, expectedStr)
}

func (e *DefaultSegmentEvaluator) startsWith(actual, expected interface{}) bool {
	actualStr := e.toString(actual)
	expectedStr := e.toString(expected)
	if actualStr == "" || expectedStr == "" {
		return false
	}
	return strings.HasPrefix(actualStr, expectedStr)
}

func (e *DefaultSegmentEvaluator) endsWith(actual, expected interface{}) bool {
	actualStr := e.toString(actual)
	expectedStr := e.toString(expected)
	if actualStr == "" || expectedStr == "" {
		return false
	}
	return strings.HasSuffix(actualStr, expectedStr)
}

func (e *DefaultSegmentEvaluator) matchesRegex(actual, expected interface{}) bool {
	// Note: In production, you'd want to use regexp package
	// This is a simplified implementation
	actualStr := e.toString(actual)
	expectedStr := e.toString(expected)
	return actualStr == expectedStr // Placeholder implementation
}

func (e *DefaultSegmentEvaluator) isGreaterThan(actual, expected interface{}) bool {
	actualNum := e.toFloat64(actual)
	expectedNum := e.toFloat64(expected)
	if actualNum == nil || expectedNum == nil {
		return false
	}
	return *actualNum > *expectedNum
}

func (e *DefaultSegmentEvaluator) isGreaterThanOrEqual(actual, expected interface{}) bool {
	actualNum := e.toFloat64(actual)
	expectedNum := e.toFloat64(expected)
	if actualNum == nil || expectedNum == nil {
		return false
	}
	return *actualNum >= *expectedNum
}

func (e *DefaultSegmentEvaluator) isLessThan(actual, expected interface{}) bool {
	actualNum := e.toFloat64(actual)
	expectedNum := e.toFloat64(expected)
	if actualNum == nil || expectedNum == nil {
		return false
	}
	return *actualNum < *expectedNum
}

func (e *DefaultSegmentEvaluator) isLessThanOrEqual(actual, expected interface{}) bool {
	actualNum := e.toFloat64(actual)
	expectedNum := e.toFloat64(expected)
	if actualNum == nil || expectedNum == nil {
		return false
	}
	return *actualNum <= *expectedNum
}

func (e *DefaultSegmentEvaluator) isVersionGreaterThan(actual, expected interface{}) bool {
	// Simplified version comparison - in production, use a proper semver library
	actualStr := e.toString(actual)
	expectedStr := e.toString(expected)
	return actualStr > expectedStr
}

func (e *DefaultSegmentEvaluator) isVersionLessThan(actual, expected interface{}) bool {
	// Simplified version comparison - in production, use a proper semver library
	actualStr := e.toString(actual)
	expectedStr := e.toString(expected)
	return actualStr < expectedStr
}

// Type conversion helpers

func (e *DefaultSegmentEvaluator) toString(value interface{}) string {
	if value == nil {
		return ""
	}
	if str, ok := value.(string); ok {
		return str
	}
	return fmt.Sprintf("%v", value)
}

func (e *DefaultSegmentEvaluator) toFloat64(value interface{}) *float64 {
	if value == nil {
		return nil
	}

	switch v := value.(type) {
	case float64:
		return &v
	case float32:
		f64 := float64(v)
		return &f64
	case int:
		f64 := float64(v)
		return &f64
	case int32:
		f64 := float64(v)
		return &f64
	case int64:
		f64 := float64(v)
		return &f64
	case string:
		if f64, err := strconv.ParseFloat(v, 64); err == nil {
			return &f64
		}
	}
	return nil
}