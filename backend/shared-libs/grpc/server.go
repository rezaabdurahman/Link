package grpc

import (
	"context"
	"fmt"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"

	"github.com/link-app/shared-libs/grpc/interceptors"
	"github.com/link-app/shared-libs/grpc/registry"
)

// ServerConfig holds gRPC server configuration
type ServerConfig struct {
	Port                int
	ServiceName         string
	MaxRecvMsgSize      int
	MaxSendMsgSize      int
	ConnectionTimeout   time.Duration
	MaxConnectionIdle   time.Duration
	MaxConnectionAge    time.Duration
	MaxConnectionAgeGrace time.Duration
	Time                time.Duration
	Timeout             time.Duration
	EnableReflection    bool
	EnableHealthCheck   bool
	EnableServiceRegistry bool
	RegistryEndpoint    string
}

// DefaultServerConfig returns default gRPC server configuration
func DefaultServerConfig() *ServerConfig {
	return &ServerConfig{
		Port:                  50051,
		ServiceName:           "unknown",
		MaxRecvMsgSize:        1024 * 1024 * 4, // 4MB
		MaxSendMsgSize:        1024 * 1024 * 4, // 4MB
		ConnectionTimeout:     60 * time.Second,
		MaxConnectionIdle:     15 * time.Second,
		MaxConnectionAge:      30 * time.Second,
		MaxConnectionAgeGrace: 5 * time.Second,
		Time:                  10 * time.Second,
		Timeout:               3 * time.Second,
		EnableReflection:      true,
		EnableHealthCheck:     true,
		EnableServiceRegistry: true,
		RegistryEndpoint:      "localhost:8500", // Default Consul endpoint
	}
}

// Server wraps gRPC server with additional functionality
type Server struct {
	*grpc.Server
	config       *ServerConfig
	healthServer *health.Server
	registry     *registry.ServiceRegistry
	listener     net.Listener
}

// NewServer creates a new gRPC server with interceptors and middleware
func NewServer(config *ServerConfig) (*Server, error) {
	if config == nil {
		config = DefaultServerConfig()
	}

	// Create interceptors
	unaryInterceptors := []grpc.UnaryServerInterceptor{
		interceptors.UnaryLoggingInterceptor(),
		interceptors.UnaryMetricsInterceptor(),
		interceptors.UnaryAuthInterceptor(),
		interceptors.UnaryErrorInterceptor(),
		interceptors.UnaryRecoveryInterceptor(),
	}

	streamInterceptors := []grpc.StreamServerInterceptor{
		interceptors.StreamLoggingInterceptor(),
		interceptors.StreamMetricsInterceptor(),
		interceptors.StreamAuthInterceptor(),
		interceptors.StreamErrorInterceptor(),
		interceptors.StreamRecoveryInterceptor(),
	}

	// Create server options
	opts := []grpc.ServerOption{
		grpc.ChainUnaryInterceptor(unaryInterceptors...),
		grpc.ChainStreamInterceptor(streamInterceptors...),
		grpc.MaxRecvMsgSize(config.MaxRecvMsgSize),
		grpc.MaxSendMsgSize(config.MaxSendMsgSize),
		grpc.ConnectionTimeout(config.ConnectionTimeout),
		grpc.KeepaliveParams(keepalive.ServerParameters{
			MaxConnectionIdle:     config.MaxConnectionIdle,
			MaxConnectionAge:      config.MaxConnectionAge,
			MaxConnectionAgeGrace: config.MaxConnectionAgeGrace,
			Time:                  config.Time,
			Timeout:               config.Timeout,
		}),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             5 * time.Second,
			PermitWithoutStream: true,
		}),
	}

	// Create gRPC server
	grpcServer := grpc.NewServer(opts...)

	// Create listener
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", config.Port))
	if err != nil {
		return nil, fmt.Errorf("failed to listen on port %d: %w", config.Port, err)
	}

	server := &Server{
		Server:   grpcServer,
		config:   config,
		listener: listener,
	}

	// Setup health checking
	if config.EnableHealthCheck {
		server.healthServer = health.NewServer()
		grpc_health_v1.RegisterHealthServer(grpcServer, server.healthServer)
	}

	// Setup reflection
	if config.EnableReflection {
		reflection.Register(grpcServer)
	}

	// Setup service registry
	if config.EnableServiceRegistry {
		server.registry = registry.NewServiceRegistry(config.RegistryEndpoint)
	}

	return server, nil
}

// Start starts the gRPC server
func (s *Server) Start() error {
	// Register service in service discovery
	if s.registry != nil {
		if err := s.registry.Register(s.config.ServiceName, s.config.Port); err != nil {
			return fmt.Errorf("failed to register service: %w", err)
		}
	}

	// Set health status to serving
	if s.healthServer != nil {
		s.healthServer.SetServingStatus(s.config.ServiceName, grpc_health_v1.HealthCheckResponse_SERVING)
	}

	fmt.Printf("gRPC server starting on port %d\n", s.config.Port)
	return s.Serve(s.listener)
}

// Stop gracefully stops the gRPC server
func (s *Server) Stop(ctx context.Context) error {
	// Set health status to not serving
	if s.healthServer != nil {
		s.healthServer.SetServingStatus(s.config.ServiceName, grpc_health_v1.HealthCheckResponse_NOT_SERVING)
	}

	// Deregister from service discovery
	if s.registry != nil {
		if err := s.registry.Deregister(s.config.ServiceName); err != nil {
			fmt.Printf("Failed to deregister service: %v\n", err)
		}
	}

	// Graceful shutdown with timeout
	done := make(chan struct{})
	go func() {
		s.GracefulStop()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		s.Server.Stop()
		return ctx.Err()
	}
}

// GetPort returns the port the server is listening on
func (s *Server) GetPort() int {
	return s.config.Port
}

// GetServiceName returns the service name
func (s *Server) GetServiceName() string {
	return s.config.ServiceName
}

// SetHealthStatus sets the health status for a service
func (s *Server) SetHealthStatus(service string, status grpc_health_v1.HealthCheckResponse_ServingStatus) {
	if s.healthServer != nil {
		s.healthServer.SetServingStatus(service, status)
	}
}