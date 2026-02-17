package embed

import (
	"io/fs"
	"log"
	"net/http"
	"strings"
)

// SPAHandler serves the embedded SPA with index.html fallback for client-side routing.
func SPAHandler() http.Handler {
	distFS, err := fs.Sub(Dist, "dist")
	if err != nil {
		log.Fatalf("embedded dist/ not found: %v", err)
	}

	fileServer := http.FileServer(http.FS(distFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")

		// Try to serve the file directly
		if path != "" {
			if f, err := distFS.Open(path); err == nil {
				f.Close()
				fileServer.ServeHTTP(w, r)
				return
			}
		}

		// Fallback to index.html for client-side routing
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
