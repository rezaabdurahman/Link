package tracing

import (
	"context"
	"fmt"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.12.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	serviceName    = "feature-svc"
	serviceVersion = "1.0.0"
)

var tracer trace.Tracer

// InitTracing initializes OpenTelemetry tracing
func InitTracing(ctx context.Context) (func(context.Context) error, error) {
	// Create resource
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String(serviceVersion),
			semconv.ServiceInstanceIDKey.String(os.Getenv("HOSTNAME")),
			attribute.String("environment", getEnvironment()),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create exporter based on configuration
	exporter, err := createExporter(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create exporter: %w", err)
	}

	// Create trace provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(createSampler()),
	)

	// Set global trace provider
	otel.SetTracerProvider(tp)

	// Set global propagator
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	// Create tracer
	tracer = otel.Tracer(serviceName)

	// Return shutdown function
	return tp.Shutdown, nil
}

// createExporter creates a trace exporter based on configuration
func createExporter(ctx context.Context) (sdktrace.SpanExporter, error) {
	exporterType := os.Getenv("TRACE_EXPORTER")
	
	switch exporterType {
	case "jaeger":
		return createJaegerExporter()
	case "otlp":
		return createOTLPExporter(ctx)
	default:
		// Default to OTLP if not specified
		return createOTLPExporter(ctx)
	}
}

// createJaegerExporter creates a Jaeger exporter
func createJaegerExporter() (sdktrace.SpanExporter, error) {
	jaegerEndpoint := os.Getenv("JAEGER_ENDPOINT")
	if jaegerEndpoint == "" {
		jaegerEndpoint = "http://localhost:14268/api/traces"
	}

	return jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(jaegerEndpoint)))
}

// createOTLPExporter creates an OTLP exporter
func createOTLPExporter(ctx context.Context) (sdktrace.SpanExporter, error) {
	otlpEndpoint := os.Getenv("OTLP_ENDPOINT")
	if otlpEndpoint == "" {
		otlpEndpoint = "localhost:4317"
	}

	conn, err := grpc.DialContext(ctx, otlpEndpoint,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create gRPC connection to collector: %w", err)
	}

	return otlptrace.New(ctx, otlptracegrpc.NewClient(otlptracegrpc.WithGRPCConn(conn)))
}

// createSampler creates a trace sampler based on configuration
func createSampler() sdktrace.Sampler {
	samplingRate := os.Getenv("TRACE_SAMPLING_RATE")
	
	switch samplingRate {
	case "always":
		return sdktrace.AlwaysSample()
	case "never":
		return sdktrace.NeverSample()
	default:
		// Default to 10% sampling
		return sdktrace.TraceIDRatioBased(0.1)
	}
}

// getEnvironment returns the current environment
func getEnvironment() string {
	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		return "development"
	}
	return env
}

// StartSpan starts a new trace span
func StartSpan(ctx context.Context, operationName string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return tracer.Start(ctx, operationName, trace.WithAttributes(attrs...))
}

// TraceFeatureFlagEvaluation creates a span for feature flag evaluation
func TraceFeatureFlagEvaluation(ctx context.Context, flagKey string, userID string) (context.Context, trace.Span) {
	return tracer.Start(ctx, "feature_flag_evaluation",
		trace.WithAttributes(
			attribute.String("feature.flag_key", flagKey),
			attribute.String("user.id", userID),
			attribute.String("operation.type", "flag_evaluation"),
		),
	)
}

// AddSpanAttributes adds attributes to the current span
func AddSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.SetAttributes(attrs...)
	}
}

// RecordSpanError records an error on the current span
func RecordSpanError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.RecordError(err)
		span.SetStatus(trace.Status{
			Code:        trace.StatusCodeError,
			Description: err.Error(),
		})
	}
}