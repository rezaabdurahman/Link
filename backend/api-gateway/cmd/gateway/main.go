package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"api-gateway/internal/config"
	"api-gateway/internal/handlers"
)

func main() {
	log.Println("Starting API Gateway...")

	// Load enhanced service configuration
	serviceConfig, err := config.LoadEnhancedServicesConfig()
	if err != nil {
		log.Fatalf("Failed to load service configuration: %v", err)
	}

	log.Printf("Loaded configuration for %d services", len(serviceConfig.Services))
	for serviceName, service := range serviceConfig.Services {
		log.Printf("Service %s: %d instances", serviceName, len(service.Instances))
	}

	// Create enhanced proxy handler
	proxyHandler := handlers.NewEnhancedProxyHandler(serviceConfig)

	// Start health checkers for all services
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	for serviceName := range serviceConfig.Services {
		if lb, err := serviceConfig.GetLoadBalancer(serviceName); err == nil {
			if healthChecker := lb.GetHealthChecker(); healthChecker != nil {
				go healthChecker.Start(ctx)
				log.Printf("Started health checker for service: %s", serviceName)
			}
		}
	}

	// Setup router
	router := mux.NewRouter()

	// Health check endpoint
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		healthStatus := proxyHandler.HealthCheck()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(healthStatus)
	}).Methods("GET")

	// Metrics endpoint
	router.Handle("/metrics", promhttp.Handler()).Methods("GET")

	// Service endpoints with load balancing
	router.PathPrefix("/").Handler(proxyHandler)

	// Configure server
	server := &http.Server{
		Addr:         getEnvOrDefault("PORT", ":8080"),
		Handler:      router,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("API Gateway listening on %s", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down API Gateway...")

	// Cancel health checkers
	cancel()

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("API Gateway stopped")
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
