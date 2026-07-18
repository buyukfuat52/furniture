package main

import (
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/buyukfuat52/furniture/services/core/internal/app"
	"github.com/buyukfuat52/furniture/services/core/internal/httpapi"
)

func main() {
	addr := getenv("CORE_ADDR", ":8080")
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{}))

	service := app.NewDemoService(time.Now)
	server := &http.Server{
		Addr:              addr,
		Handler:           httpapi.NewServer(service, logger),
		ReadHeaderTimeout: 5 * time.Second,
	}

	logger.Info("core service starting", "addr", addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("core service stopped", "error", err)
		os.Exit(1)
	}
}

func getenv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
