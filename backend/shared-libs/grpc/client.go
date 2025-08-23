package grpc

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"

	"github.com/link-app/shared-libs/grpc/interceptors"
	"github.com/link-app/shared-libs/grpc/registry"
)

// ClientConfig holds gRPC client configuration
type ClientConfig struct {
	ServiceName       string
	DirectEndpoint    string        // Direct endpoint (e.g., "localhost:50051")
	UseServiceDiscovery bool
	RegistryEndpoint  string
	ConnectTimeout    time.Duration
	RequestTimeout    time.Duration
	MaxRecvMsgSize    int
	MaxSendMsgSize    int
	KeepAliveTime     time.Duration
	KeepAliveTimeout  time.Duration
	EnableRetry       bool
	MaxRetryAttempts  int
	EnableLoadBalancing bool
}

// DefaultClientConfig returns default gRPC client configuration
func DefaultClientConfig(serviceName string) *ClientConfig {
	return &ClientConfig{
		ServiceName:         serviceName,
		UseServiceDiscovery: true,
		RegistryEndpoint:    "localhost:8500",
		ConnectTimeout:      30 * time.Second,
		RequestTimeout:      30 * time.Second,
		MaxRecvMsgSize:      1024 * 1024 * 4, // 4MB
		MaxSendMsgSize:      1024 * 1024 * 4, // 4MB
		KeepAliveTime:       30 * time.Second,
		KeepAliveTimeout:    5 * time.Second,
		EnableRetry:         true,
		MaxRetryAttempts:    3,
		EnableLoadBalancing: true,
	}
}

// Client wraps gRPC client connection with additional functionality
type Client struct {
	*grpc.ClientConn
	config   *ClientConfig
	registry *registry.ServiceRegistry
}

// NewClient creates a new gRPC client connection
func NewClient(config *ClientConfig) (*Client, error) {
	if config == nil {
		return nil, fmt.Errorf("client config is required")
	}

	var target string
	var serviceRegistry *registry.ServiceRegistry

	// Determine target endpoint
	if config.UseServiceDiscovery && config.DirectEndpoint == "" {
		serviceRegistry = registry.NewServiceRegistry(config.RegistryEndpoint)
		endpoint, err := serviceRegistry.Discover(config.ServiceName)
		if err != nil {
			return nil, fmt.Errorf("failed to discover service %s: %w", config.ServiceName, err)
		}
		target = endpoint
	} else if config.DirectEndpoint != "" {
		target = config.DirectEndpoint
	} else {
		return nil, fmt.Errorf("either DirectEndpoint or UseServiceDiscovery must be configured")
	}

	// Create interceptors
	unaryInterceptors := []grpc.UnaryClientInterceptor{
		interceptors.UnaryClientLoggingInterceptor(),
		interceptors.UnaryClientMetricsInterceptor(),
		interceptors.UnaryClientAuthInterceptor(),
	}

	streamInterceptors := []grpc.StreamClientInterceptor{
		interceptors.StreamClientLoggingInterceptor(),
		interceptors.StreamClientMetricsInterceptor(),
		interceptors.StreamClientAuthInterceptor(),
	}

	// Add retry interceptor if enabled
	if config.EnableRetry {
		unaryInterceptors = append(unaryInterceptors, interceptors.UnaryClientRetryInterceptor(config.MaxRetryAttempts))
		streamInterceptors = append(streamInterceptors, interceptors.StreamClientRetryInterceptor(config.MaxRetryAttempts))
	}

	// Create dial options
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()), // TODO: Add TLS support
		grpc.WithChainUnaryInterceptor(unaryInterceptors...),
		grpc.WithChainStreamInterceptor(streamInterceptors...),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(config.MaxRecvMsgSize),
			grpc.MaxCallSendMsgSize(config.MaxSendMsgSize),
		),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                config.KeepAliveTime,
			Timeout:             config.KeepAliveTimeout,
			PermitWithoutStream: true,
		}),
	}

	// Add load balancing if enabled
	if config.EnableLoadBalancing && config.UseServiceDiscovery {
		opts = append(opts, grpc.WithDefaultServiceConfig(`{
			"loadBalancingPolicy":"round_robin",
			"healthCheckConfig": {
				"serviceName": "`+config.ServiceName+`"
			}
		}`))
	}

	// Create connection with timeout
	ctx, cancel := context.WithTimeout(context.Background(), config.ConnectTimeout)
	defer cancel()

	conn, err := grpc.DialContext(ctx, target, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s at %s: %w", config.ServiceName, target, err)
	}

	return &Client{
		ClientConn: conn,
		config:     config,
		registry:   serviceRegistry,
	}, nil
}

// Close closes the client connection
func (c *Client) Close() error {
	return c.ClientConn.Close()
}

// GetServiceName returns the service name
func (c *Client) GetServiceName() string {
	return c.config.ServiceName
}

// GetEndpoint returns the current endpoint
func (c *Client) GetEndpoint() string {
	if c.config.DirectEndpoint != "" {
		return c.config.DirectEndpoint
	}
	if c.registry != nil {
		endpoint, _ := c.registry.Discover(c.config.ServiceName)
		return endpoint
	}
	return "unknown"
}

// CreateContext creates a context with default timeout
func (c *Client) CreateContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), c.config.RequestTimeout)
}

// CreateContextWithTimeout creates a context with custom timeout
func (c *Client) CreateContextWithTimeout(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}

// WaitForReady waits for the connection to be ready
func (c *Client) WaitForReady(ctx context.Context) error {
	state := c.ClientConn.GetState()
	c.ClientConn.WaitForStateChange(ctx, state)
	return nil
}

// IsReady checks if the connection is ready
func (c *Client) IsReady() bool {
	state := c.ClientConn.GetState()
	return state.String() == "READY"
}

// ClientPool manages a pool of gRPC clients for load balancing and failover
type ClientPool struct {
	clients []*Client
	current int
	config  *ClientConfig
}

// NewClientPool creates a new client pool
func NewClientPool(config *ClientConfig, poolSize int) (*ClientPool, error) {
	if poolSize <= 0 {
		poolSize = 1
	}

	clients := make([]*Client, poolSize)
	for i := 0; i < poolSize; i++ {
		client, err := NewClient(config)
		if err != nil {
			// Clean up any successfully created clients
			for j := 0; j < i; j++ {
				clients[j].Close()
			}
			return nil, fmt.Errorf("failed to create client %d: %w", i, err)
		}
		clients[i] = client
	}

	return &ClientPool{
		clients: clients,
		current: 0,
		config:  config,
	}, nil
}

// GetClient returns the next available client using round-robin
func (p *ClientPool) GetClient() *Client {
	client := p.clients[p.current]
	p.current = (p.current + 1) % len(p.clients)
	return client
}

// Close closes all clients in the pool
func (p *ClientPool) Close() error {
	var lastErr error
	for _, client := range p.clients {
		if err := client.Close(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// Size returns the pool size
func (p *ClientPool) Size() int {
	return len(p.clients)
}