package server

// Config holds all playground server configuration.
type Config struct {
	Port        int
	Backends    []string
	RedisURL    string
	PostgresURL string
	ScanPorts   string
	NoScan      bool
	OpenBrowser bool
	Verbose     bool
	DataDir     string
}

// DefaultConfig returns a Config with sensible defaults.
func DefaultConfig() *Config {
	return &Config{
		Port:        4200,
		Backends:    []string{"memory"},
		RedisURL:    "redis://localhost:6379",
		PostgresURL: "postgres://localhost:5432/ojs?sslmode=disable",
		ScanPorts:   "3000-9999",
		NoScan:      false,
		OpenBrowser: true,
		Verbose:     false,
		DataDir:     "",
	}
}
