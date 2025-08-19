package tracing

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
)

// InitTracing initializes OpenTelemetry with OTLP exporter (compatible with Jaeger)
func InitTracing(serviceName string) (func(), error) {
	// Get OTLP endpoint from environment or use default (Jaeger OTLP receiver)
	otlpEndpoint := getEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://localhost:4318/v1/traces")
	
	// Create OTLP HTTP exporter
	exp, err := otlptracehttp.New(context.Background(),
		otlptracehttp.WithEndpoint(otlpEndpoint),
		otlptracehttp.WithInsecure(), // Use HTTP instead of HTTPS for local development
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Create resource with service information
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String(getEnv("SERVICE_VERSION", "1.0.0")),
			semconv.DeploymentEnvironmentKey.String(getEnv("ENVIRONMENT", "development")),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create trace provider with batch span processor
	tp := trace.NewTracerProvider(
		trace.WithBatcher(exp,
			trace.WithBatchTimeout(time.Second*5),
			trace.WithMaxExportBatchSize(100),
		),
		trace.WithResource(res),
		trace.WithSampler(getSampler()),
	)

	// Set global trace provider
	otel.SetTracerProvider(tp)

	// Set global propagator to handle trace context propagation
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	log.Printf("✓ Tracing initialized for service: %s, endpoint: %s", serviceName, otlpEndpoint)

	// Return cleanup function
	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := tp.Shutdown(ctx); err != nil {
			log.Printf("Error shutting down tracer provider: %v", err)
		}
	}, nil
}

// getSampler returns the appropriate sampler based on environment
func getSampler() trace.Sampler {
	env := getEnv("ENVIRONMENT", "development")
	samplingRateStr := getEnv("TRACING_SAMPLING_RATE", "")
	
	switch env {
	case "production":
		// In production, sample less to reduce overhead
		if samplingRateStr != "" {
			if rate := parseFloat(samplingRateStr, 0.1); rate > 0 {
				return trace.TraceIDRatioBased(rate)
			}
		}
		return trace.TraceIDRatioBased(0.1) // 10% sampling in production
	case "staging":
		return trace.TraceIDRatioBased(0.5) // 50% sampling in staging
	default:
		// Development - sample everything for debugging
		return trace.AlwaysSample()
	}
}

// parseFloat safely parses a string to float64 with fallback
func parseFloat(s string, fallback float64) float64 {
	if s == "" {
		return fallback
	}
	// Simple parsing - in production you'd want proper error handling
	var result float64
	if _, err := fmt.Sscanf(s, "%f", &result); err != nil {
		return fallback
	}
	return result
}

// getEnv gets environment variable with fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// GetTracer returns a tracer for the given name
func GetTracer(name string) oteltrace.Tracer {
	return otel.Tracer(name)
}
