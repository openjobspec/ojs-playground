package conformance

import (
	"errors"
	"fmt"
)

const (
	FailureBackend = "backend_failure"
	FailureRunner  = "runner_error"
)

type runnerSemanticError struct {
	message string
}

func (e *runnerSemanticError) Error() string {
	return e.message
}

func runnerErrorf(format string, args ...any) error {
	return &runnerSemanticError{message: fmt.Sprintf(format, args...)}
}

func isRunnerSemanticError(err error) bool {
	var semanticError *runnerSemanticError
	return errors.As(err, &semanticError)
}
