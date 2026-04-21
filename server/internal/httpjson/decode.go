// Package httpjson provides bounded JSON request decoding.
package httpjson

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

const (
	MaxAPIRequestBytes      int64 = 1 << 20
	MaxProtocolRequestBytes int64 = 2 << 20
	MaxArgsBytes                  = 512 << 10
	MaxMetaBytes                  = 256 << 10
	MaxOutputBytes                = 1 << 20
	MaxErrorBytes                 = 256 << 10
	MaxTypeLength                 = 255
	MaxQueueLength                = 128
	MaxWorkerIDLength             = 255
	MaxListLimit                  = 200
	MaxHistoryLimit               = 500
	MaxFetchCount                 = 100
	MaxStringListItems            = 100
)

// DecodeError describes a client-safe JSON decoding failure.
type DecodeError struct {
	Status  int
	Message string
}

func (e *DecodeError) Error() string {
	return e.Message
}

// Decode strictly decodes one JSON value from a size-limited request body.
// It is intended for playground-owned API DTOs.
func Decode(
	w http.ResponseWriter,
	r *http.Request,
	dst any,
	maxBytes int64,
	allowEmpty bool,
) *DecodeError {
	return decode(w, r, dst, maxBytes, allowEmpty, true)
}

// DecodeLenient decodes one JSON value from a size-limited request body while
// allowing unknown object fields. It is intended for extensible OJS protocol
// payloads, which must remain forward-compatible.
func DecodeLenient(
	w http.ResponseWriter,
	r *http.Request,
	dst any,
	maxBytes int64,
	allowEmpty bool,
) *DecodeError {
	return decode(w, r, dst, maxBytes, allowEmpty, false)
}

func decode(
	w http.ResponseWriter,
	r *http.Request,
	dst any,
	maxBytes int64,
	allowEmpty bool,
	rejectUnknown bool,
) *DecodeError {
	if maxBytes <= 0 {
		return &DecodeError{Status: http.StatusInternalServerError, Message: "Invalid server body limit"}
	}
	if r.ContentLength > maxBytes {
		return &DecodeError{Status: http.StatusRequestEntityTooLarge, Message: "Request body is too large"}
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	decoder := json.NewDecoder(r.Body)
	if rejectUnknown {
		decoder.DisallowUnknownFields()
	}

	if err := decoder.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) && allowEmpty {
			return nil
		}
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return &DecodeError{Status: http.StatusRequestEntityTooLarge, Message: "Request body is too large"}
		}
		return &DecodeError{Status: http.StatusBadRequest, Message: "Invalid JSON: " + err.Error()}
	}

	var extra json.RawMessage
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return &DecodeError{Status: http.StatusBadRequest, Message: "Invalid JSON: request body must contain one value"}
		}
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return &DecodeError{Status: http.StatusRequestEntityTooLarge, Message: "Request body is too large"}
		}
		return &DecodeError{Status: http.StatusBadRequest, Message: "Invalid JSON: " + err.Error()}
	}
	return nil
}

// RequireRawJSON validates that a raw field is bounded and contains JSON.
func RequireRawJSON(field string, value json.RawMessage, maxBytes int, allowEmpty bool) *DecodeError {
	if len(value) == 0 {
		if allowEmpty {
			return nil
		}
		return &DecodeError{Status: http.StatusBadRequest, Message: fmt.Sprintf("Field %q is required", field)}
	}
	if len(value) > maxBytes {
		return &DecodeError{Status: http.StatusRequestEntityTooLarge, Message: fmt.Sprintf("Field %q is too large", field)}
	}
	if !json.Valid(value) {
		return &DecodeError{Status: http.StatusBadRequest, Message: fmt.Sprintf("Field %q must contain valid JSON", field)}
	}
	return nil
}

// RequireJSONArray validates a bounded raw JSON array and returns its items.
func RequireJSONArray(field string, value json.RawMessage, maxBytes, maxItems int) ([]json.RawMessage, *DecodeError) {
	if decodeErr := RequireRawJSON(field, value, maxBytes, false); decodeErr != nil {
		return nil, decodeErr
	}
	if first := bytes.TrimSpace(value); len(first) == 0 || first[0] != '[' {
		return nil, &DecodeError{Status: http.StatusBadRequest, Message: fmt.Sprintf("Field %q must be a JSON array", field)}
	}
	var items []json.RawMessage
	if err := json.Unmarshal(value, &items); err != nil {
		return nil, &DecodeError{Status: http.StatusBadRequest, Message: fmt.Sprintf("Field %q must be a JSON array", field)}
	}
	if len(items) > maxItems {
		return nil, &DecodeError{Status: http.StatusRequestEntityTooLarge, Message: fmt.Sprintf("Field %q has too many items", field)}
	}
	return items, nil
}

// RequireJSONObject validates a bounded raw JSON object and returns its fields.
func RequireJSONObject(field string, value json.RawMessage, maxBytes, maxKeys int, allowEmpty bool) (map[string]json.RawMessage, *DecodeError) {
	if decodeErr := RequireRawJSON(field, value, maxBytes, allowEmpty); decodeErr != nil {
		return nil, decodeErr
	}
	if len(value) == 0 && allowEmpty {
		return nil, nil
	}
	if first := bytes.TrimSpace(value); len(first) == 0 || first[0] != '{' {
		return nil, &DecodeError{Status: http.StatusBadRequest, Message: fmt.Sprintf("Field %q must be a JSON object", field)}
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(value, &fields); err != nil {
		return nil, &DecodeError{Status: http.StatusBadRequest, Message: fmt.Sprintf("Field %q must be a JSON object", field)}
	}
	if len(fields) > maxKeys {
		return nil, &DecodeError{Status: http.StatusRequestEntityTooLarge, Message: fmt.Sprintf("Field %q has too many keys", field)}
	}
	return fields, nil
}

// ClampPagination applies safe defaults and upper bounds.
func ClampPagination(limit, offset, defaultLimit, maxLimit int) (int, int) {
	if limit <= 0 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}
