package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/openjobspec/ojs-playground/server/internal/httpjson"
)

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// WriteError writes a JSON error response.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]any{
		"error": map[string]any{
			"message":    message,
			"status":     status,
			"request_id": w.Header().Get("X-Request-Id"),
		},
	})
}

func parsePagination(r *http.Request, defaultLimit, maxLimit int) (int, int, *httpjson.DecodeError) {
	limit := 0
	offset := 0
	if raw := r.URL.Query().Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			return 0, 0, &httpjson.DecodeError{Status: http.StatusBadRequest, Message: "Query parameter 'limit' must be an integer"}
		}
		limit = value
	}
	if raw := r.URL.Query().Get("offset"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			return 0, 0, &httpjson.DecodeError{Status: http.StatusBadRequest, Message: "Query parameter 'offset' must be an integer"}
		}
		offset = value
	}
	limit, offset = httpjson.ClampPagination(limit, offset, defaultLimit, maxLimit)
	return limit, offset, nil
}
