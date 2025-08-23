package interceptors

import (
	"context"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/status"
)

var (
	// Server metrics
	grpcRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_server_requests_total",
			Help: "Total number of gRPC requests received",
		},
		[]string{"service", "method", "status_code"},
	)

	grpcRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grpc_server_request_duration_seconds",
			Help:    "Duration of gRPC requests in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"service", "method", "status_code"},
	)

	grpcStreamMessagesReceived = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_server_stream_messages_received_total",
			Help: "Total number of messages received on server streams",
		},
		[]string{"service", "method"},
	)

	grpcStreamMessagesSent = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_server_stream_messages_sent_total",
			Help: "Total number of messages sent on server streams",
		},
		[]string{"service", "method"},
	)

	// Client metrics
	grpcClientRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "grpc_client_requests_total",
			Help: "Total number of gRPC client requests sent",
		},
		[]string{"service", "method", "status_code"},
	)

	grpcClientRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "grpc_client_request_duration_seconds",
			Help:    "Duration of gRPC client requests in seconds",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"service", "method", "status_code"},
	)

	grpcConnectionsActive = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "grpc_connections_active",
			Help: "Number of active gRPC connections",
		},
		[]string{"service", "direction"}, // direction: "inbound" or "outbound"
	)
)

// UnaryMetricsInterceptor records metrics for unary gRPC requests
func UnaryMetricsInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()

		// Extract service and method names
		service, method := parseFullMethod(info.FullMethod)

		// Increment active connections
		grpcConnectionsActive.WithLabelValues(service, "inbound").Inc()
		defer grpcConnectionsActive.WithLabelValues(service, "inbound").Dec()

		// Call the handler
		resp, err := handler(ctx, req)

		// Record metrics
		duration := time.Since(start)
		statusCode := status.Code(err).String()

		grpcRequestsTotal.WithLabelValues(service, method, statusCode).Inc()
		grpcRequestDuration.WithLabelValues(service, method, statusCode).Observe(duration.Seconds())

		return resp, err
	}
}

// StreamMetricsInterceptor records metrics for streaming gRPC requests
func StreamMetricsInterceptor() grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		start := time.Now()

		// Extract service and method names
		service, method := parseFullMethod(info.FullMethod)

		// Increment active connections
		grpcConnectionsActive.WithLabelValues(service, "inbound").Inc()
		defer grpcConnectionsActive.WithLabelValues(service, "inbound").Dec()

		// Wrap the stream to count messages
		wrappedStream := &metricsServerStream{
			ServerStream: stream,
			service:      service,
			method:       method,
		}

		// Call the handler
		err := handler(srv, wrappedStream)

		// Record metrics
		duration := time.Since(start)
		statusCode := status.Code(err).String()

		grpcRequestsTotal.WithLabelValues(service, method, statusCode).Inc()
		grpcRequestDuration.WithLabelValues(service, method, statusCode).Observe(duration.Seconds())

		return err
	}
}

// UnaryClientMetricsInterceptor records metrics for gRPC client requests
func UnaryClientMetricsInterceptor() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		start := time.Now()

		// Extract service and method names
		service, methodName := parseFullMethod(method)

		// Increment active connections
		grpcConnectionsActive.WithLabelValues(service, "outbound").Inc()
		defer grpcConnectionsActive.WithLabelValues(service, "outbound").Dec()

		// Make the call
		err := invoker(ctx, method, req, reply, cc, opts...)

		// Record metrics
		duration := time.Since(start)
		statusCode := status.Code(err).String()

		grpcClientRequestsTotal.WithLabelValues(service, methodName, statusCode).Inc()
		grpcClientRequestDuration.WithLabelValues(service, methodName, statusCode).Observe(duration.Seconds())

		return err
	}
}

// StreamClientMetricsInterceptor records metrics for gRPC client streaming requests
func StreamClientMetricsInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		start := time.Now()

		// Extract service and method names
		service, methodName := parseFullMethod(method)

		// Increment active connections
		grpcConnectionsActive.WithLabelValues(service, "outbound").Inc()

		// Create the stream
		stream, err := streamer(ctx, desc, cc, method, opts...)
		if err != nil {
			grpcConnectionsActive.WithLabelValues(service, "outbound").Dec()
			statusCode := status.Code(err).String()
			grpcClientRequestsTotal.WithLabelValues(service, methodName, statusCode).Inc()
			return nil, err
		}

		return &metricsClientStream{
			ClientStream: stream,
			service:      service,
			method:       methodName,
			start:        start,
		}, nil
	}
}

// metricsServerStream wraps a server stream to count messages
type metricsServerStream struct {
	grpc.ServerStream
	service string
	method  string
}

func (s *metricsServerStream) SendMsg(m interface{}) error {
	err := s.ServerStream.SendMsg(m)
	if err == nil {
		grpcStreamMessagesSent.WithLabelValues(s.service, s.method).Inc()
	}
	return err
}

func (s *metricsServerStream) RecvMsg(m interface{}) error {
	err := s.ServerStream.RecvMsg(m)
	if err == nil {
		grpcStreamMessagesReceived.WithLabelValues(s.service, s.method).Inc()
	}
	return err
}

// metricsClientStream wraps a client stream to count messages and record final metrics
type metricsClientStream struct {
	grpc.ClientStream
	service string
	method  string
	start   time.Time
}

func (s *metricsClientStream) SendMsg(m interface{}) error {
	return s.ClientStream.SendMsg(m)
}

func (s *metricsClientStream) RecvMsg(m interface{}) error {
	return s.ClientStream.RecvMsg(m)
}

func (s *metricsClientStream) CloseSend() error {
	err := s.ClientStream.CloseSend()
	
	// Record final metrics when stream closes
	duration := time.Since(s.start)
	statusCode := status.Code(err).String()
	
	grpcClientRequestsTotal.WithLabelValues(s.service, s.method, statusCode).Inc()
	grpcClientRequestDuration.WithLabelValues(s.service, s.method, statusCode).Observe(duration.Seconds())
	grpcConnectionsActive.WithLabelValues(s.service, "outbound").Dec()
	
	return err
}

// parseFullMethod extracts service and method from full method string
// Example: "/user.UserService/GetUserProfile" -> ("UserService", "GetUserProfile")
func parseFullMethod(fullMethod string) (service, method string) {
	// Remove leading slash
	if len(fullMethod) > 0 && fullMethod[0] == '/' {
		fullMethod = fullMethod[1:]
	}

	// Split by slash
	parts := splitString(fullMethod, '/')
	if len(parts) >= 2 {
		// Extract service name from package.ServiceName format
		serviceParts := splitString(parts[0], '.')
		if len(serviceParts) >= 2 {
			service = serviceParts[len(serviceParts)-1] // Get last part (ServiceName)
		} else {
			service = parts[0]
		}
		method = parts[1]
	} else {
		service = "unknown"
		method = "unknown"
	}

	return service, method
}

// splitString splits a string by delimiter (simple implementation to avoid imports)
func splitString(s string, delimiter rune) []string {
	var parts []string
	var current string

	for _, char := range s {
		if char == delimiter {
			if current != "" {
				parts = append(parts, current)
				current = ""
			}
		} else {
			current += string(char)
		}
	}

	if current != "" {
		parts = append(parts, current)
	}

	return parts
}