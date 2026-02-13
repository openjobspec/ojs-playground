package proxy

import (
	"net/http"

	"github.com/openjobspec/ojs-playground/server/internal/chaos"
)

// ChaosInterceptor is chi middleware that applies chaos engineering faults before forwarding.
func ChaosInterceptor(chaosConfig *chaos.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check timeout first
			if chaosConfig.ShouldTimeout() {
				chaos.InjectTimeout(r.Context(), w)
				return
			}

			// Check failure injection
			if chaosConfig.ShouldFail() {
				chaos.InjectError(w)
				return
			}

			// Apply latency
			if delay := chaosConfig.GetDelay(); delay > 0 {
				chaos.InjectDelay(delay)
			}

			next.ServeHTTP(w, r)
		})
	}
}
