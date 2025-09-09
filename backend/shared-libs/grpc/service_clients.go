package grpc

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"google.golang.org/grpc"

	// Import generated proto clients
	userpb "github.com/link-app/proto/user"
	chatpb "github.com/link-app/proto/chat"
	discoverypb "github.com/link-app/proto/discovery"
	searchpb "github.com/link-app/proto/search"
	aipb "github.com/link-app/proto/ai"
)

// ServiceClients provides centralized access to all gRPC service clients
type ServiceClients struct {
	User      userpb.UserServiceClient
	Chat      chatpb.ChatServiceClient
	Discovery discoverypb.DiscoveryServiceClient
	Search    searchpb.SearchServiceClient
	AI        aipb.AIServiceClient
	
	// Internal connection management
	connections map[string]*grpc.ClientConn
}

// ServiceClientConfig holds configuration for service client connections
type ServiceClientConfig struct {
	// Service endpoints - can be overridden by environment variables
	UserServiceEndpoint      string
	ChatServiceEndpoint      string
	DiscoveryServiceEndpoint string
	SearchServiceEndpoint    string
	AIServiceEndpoint        string
	
	// Connection settings
	ConnectTimeout   time.Duration
	RequestTimeout   time.Duration
	MaxRetryAttempts int
	UseServiceMesh   bool // Use Linkerd service mesh endpoints
}

// DefaultServiceClientConfig returns default configuration
func DefaultServiceClientConfig() *ServiceClientConfig {
	return &ServiceClientConfig{
		// Default endpoints (can be overridden by environment)
		UserServiceEndpoint:      getEnvOrDefault("USER_SERVICE_ENDPOINT", "user-svc:50051"),
		ChatServiceEndpoint:      getEnvOrDefault("CHAT_SERVICE_ENDPOINT", "chat-svc:50051"),
		DiscoveryServiceEndpoint: getEnvOrDefault("DISCOVERY_SERVICE_ENDPOINT", "discovery-svc:50051"),
		SearchServiceEndpoint:    getEnvOrDefault("SEARCH_SERVICE_ENDPOINT", "search-svc:50051"),
		AIServiceEndpoint:        getEnvOrDefault("AI_SERVICE_ENDPOINT", "ai-svc:50051"),
		
		ConnectTimeout:   30 * time.Second,
		RequestTimeout:   30 * time.Second,
		MaxRetryAttempts: 3,
		UseServiceMesh:   getEnvBool("USE_SERVICE_MESH", true),
	}
}

// NewServiceClients creates all service clients with consistent configuration
func NewServiceClients(config *ServiceClientConfig) (*ServiceClients, error) {
	if config == nil {
		config = DefaultServiceClientConfig()
	}
	
	clients := &ServiceClients{
		connections: make(map[string]*grpc.ClientConn),
	}
	
	// Create connections to each service
	services := map[string]string{
		"user":      config.UserServiceEndpoint,
		"chat":      config.ChatServiceEndpoint,
		"discovery": config.DiscoveryServiceEndpoint,
		"search":    config.SearchServiceEndpoint,
		"ai":        config.AIServiceEndpoint,
	}
	
	for serviceName, endpoint := range services {
		conn, err := createServiceConnection(serviceName, endpoint, config)
		if err != nil {
			// Close any existing connections on error
			clients.Close()
			return nil, fmt.Errorf("failed to connect to %s service: %w", serviceName, err)
		}
		clients.connections[serviceName] = conn
	}
	
	// Initialize service clients
	clients.User = userpb.NewUserServiceClient(clients.connections["user"])
	clients.Chat = chatpb.NewChatServiceClient(clients.connections["chat"])
	clients.Discovery = discoverypb.NewDiscoveryServiceClient(clients.connections["discovery"])
	clients.Search = searchpb.NewSearchServiceClient(clients.connections["search"])
	clients.AI = aipb.NewAIServiceClient(clients.connections["ai"])
	
	return clients, nil
}

// createServiceConnection creates a gRPC connection to a specific service
func createServiceConnection(serviceName, endpoint string, config *ServiceClientConfig) (*grpc.ClientConn, error) {
	clientConfig := &ClientConfig{
		ServiceName:         serviceName,
		DirectEndpoint:      endpoint,
		UseServiceDiscovery: false, // Using direct endpoints for simplicity
		ConnectTimeout:      config.ConnectTimeout,
		RequestTimeout:      config.RequestTimeout,
		MaxRecvMsgSize:      4 * 1024 * 1024, // 4MB
		MaxSendMsgSize:      4 * 1024 * 1024, // 4MB
		KeepAliveTime:       30 * time.Second,
		KeepAliveTimeout:    5 * time.Second,
		EnableRetry:         true,
		MaxRetryAttempts:    config.MaxRetryAttempts,
		EnableLoadBalancing: false, // Rely on service mesh for load balancing
	}
	
	client, err := NewClient(clientConfig)
	if err != nil {
		return nil, err
	}
	
	return client.ClientConn, nil
}

// Close closes all service client connections
func (sc *ServiceClients) Close() error {
	var lastErr error
	
	for serviceName, conn := range sc.connections {
		if err := conn.Close(); err != nil {
			lastErr = fmt.Errorf("failed to close %s connection: %w", serviceName, err)
		}
	}
	
	return lastErr
}

// Health checks if all service connections are healthy
func (sc *ServiceClients) Health(ctx context.Context) error {
	for serviceName, conn := range sc.connections {
		state := conn.GetState()
		if state.String() != "READY" && state.String() != "IDLE" {
			return fmt.Errorf("%s service connection is not healthy: %s", serviceName, state.String())
		}
	}
	return nil
}

// WithTimeout creates a context with timeout for service calls
func (sc *ServiceClients) WithTimeout(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}

// StandardTimeout creates a context with the standard request timeout
func (sc *ServiceClients) StandardTimeout() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 30*time.Second)
}

// Helper functions

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

// Service-specific helper methods

// UserServiceCall provides a helper for user service calls with standard error handling
func (sc *ServiceClients) UserServiceCall(ctx context.Context, call func(userpb.UserServiceClient) error) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	
	return call(sc.User)
}

// ChatServiceCall provides a helper for chat service calls with standard error handling
func (sc *ServiceClients) ChatServiceCall(ctx context.Context, call func(chatpb.ChatServiceClient) error) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	
	return call(sc.Chat)
}

// DiscoveryServiceCall provides a helper for discovery service calls with standard error handling
func (sc *ServiceClients) DiscoveryServiceCall(ctx context.Context, call func(discoverypb.DiscoveryServiceClient) error) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	
	return call(sc.Discovery)
}

// SearchServiceCall provides a helper for search service calls with standard error handling
func (sc *ServiceClients) SearchServiceCall(ctx context.Context, call func(searchpb.SearchServiceClient) error) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	
	return call(sc.Search)
}

// AIServiceCall provides a helper for AI service calls with extended timeout
func (sc *ServiceClients) AIServiceCall(ctx context.Context, call func(aipb.AIServiceClient) error) error {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second) // AI calls may take longer
	defer cancel()
	
	return call(sc.AI)
}