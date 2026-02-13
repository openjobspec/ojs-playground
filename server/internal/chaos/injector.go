package chaos

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// InjectDelay sleeps for the configured delay duration.
func InjectDelay(delay time.Duration) {
	if delay > 0 {
		time.Sleep(delay)
	}
}

// InjectError writes a 500 error response.
func InjectError(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	fmt.Fprintf(w, `{"error":{"message":"Chaos: injected failure","code":"chaos_failure"}}`)
}

// InjectTimeout waits until the context is cancelled (simulates a timeout).
func InjectTimeout(ctx context.Context, w http.ResponseWriter) {
	<-ctx.Done()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusGatewayTimeout)
	fmt.Fprintf(w, `{"error":{"message":"Chaos: injected timeout","code":"chaos_timeout"}}`)
}
