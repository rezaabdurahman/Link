package tracing

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/semconv/v1.17.0/httpconv"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// GinMiddleware returns a Gin middleware for OpenTelemetry tracing
func GinMiddleware(serviceName string) gin.HandlerFunc {
	tracer := otel.Tracer(serviceName)

	return func(c *gin.Context) {
		// Extract trace context from incoming request headers
		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		// Start a new span
		spanName := c.Request.Method + " " + c.FullPath()
		if spanName == c.Request.Method+" " { // Handle empty FullPath
			spanName = c.Request.Method + " " + c.Request.URL.Path
		}

		ctx, span := tracer.Start(ctx, spanName, oteltrace.WithAttributes(
			httpconv.ServerRequest(serviceName, c.Request)...,
		))
		defer span.End()

		// Add custom attributes
		span.SetAttributes(
			attribute.String("http.route", c.FullPath()),
			attribute.String("http.client_ip", c.ClientIP()),
			attribute.String("http.user_agent", c.Request.UserAgent()),
		)

		// Add user information if available (set by auth middleware)
		if userID := c.GetHeader("X-User-ID"); userID != "" {
			span.SetAttributes(attribute.String("user.id", userID))
		}
		if userEmail := c.GetHeader("X-User-Email"); userEmail != "" {
			span.SetAttributes(attribute.String("user.email", userEmail))
		}

		// Replace request context with trace context
		c.Request = c.Request.WithContext(ctx)

		// Create a custom response writer to capture status code and size
		writer := &tracingResponseWriter{
			ResponseWriter: c.Writer,
			statusCode:     200, // default status code
		}
		c.Writer = writer

		// Process request
		c.Next()

		// Set response attributes
		span.SetAttributes(
			attribute.Int("http.status_code", writer.statusCode),
			attribute.Int("http.response_size", writer.responseSize),
		)

		// Set span status based on HTTP status code
		if writer.statusCode >= 400 {
			span.SetStatus(codes.Error, http.StatusText(writer.statusCode))
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// Record any errors from the request processing
		if len(c.Errors) > 0 {
			span.SetStatus(codes.Error, c.Errors.String())
			span.SetAttributes(attribute.String("gin.errors", c.Errors.String()))
		}
	}
}

// tracingResponseWriter wraps gin.ResponseWriter to capture response metrics
type tracingResponseWriter struct {
	gin.ResponseWriter
	statusCode   int
	responseSize int
}

func (w *tracingResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *tracingResponseWriter) Write(data []byte) (int, error) {
	size, err := w.ResponseWriter.Write(data)
	w.responseSize += size
	return size, err
}

func (w *tracingResponseWriter) WriteString(s string) (int, error) {
	size, err := w.ResponseWriter.WriteString(s)
	w.responseSize += size
	return size, err
}

// StartSpan is a helper function to start a manual span with the current context from gin.Context
func StartSpan(c *gin.Context, tracer oteltrace.Tracer, spanName string, opts ...oteltrace.SpanStartOption) (context.Context, oteltrace.Span) {
	return tracer.Start(c.Request.Context(), spanName, opts...)
}

// AddSpanAttributes is a helper to add attributes to the current span
func AddSpanAttributes(span oteltrace.Span, attrs ...attribute.KeyValue) {
	span.SetAttributes(attrs...)
}

// AddSpanError is a helper to record an error in the current span
func AddSpanError(span oteltrace.Span, err error) {
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

// AddSpanEvent is a helper to add an event to the current span
func AddSpanEvent(span oteltrace.Span, name string, attrs ...attribute.KeyValue) {
	span.AddEvent(name, oteltrace.WithAttributes(attrs...))
}

// PropagateTraceContext propagates the trace context to outgoing HTTP requests
func PropagateTraceContext(c *gin.Context, req *http.Request) {
	otel.GetTextMapPropagator().Inject(c.Request.Context(), propagation.HeaderCarrier(req.Header))
}
