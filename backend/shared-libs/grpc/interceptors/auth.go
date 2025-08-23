package interceptors

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const (
	// Metadata keys for authentication
	AuthorizationKey = "authorization"
	UserIDKey        = "x-user-id"
	UserEmailKey     = "x-user-email"
	UserNameKey      = "x-user-name"
	ServiceTokenKey  = "x-service-token"
)

// AuthContext holds authentication information
type AuthContext struct {
	UserID       string
	UserEmail    string
	UserName     string
	ServiceToken string
	IsService    bool
	Roles        []string
}

// AuthValidator interface for custom authentication logic
type AuthValidator interface {
	ValidateToken(ctx context.Context, token string) (*AuthContext, error)
	ValidateServiceToken(ctx context.Context, token string) (*AuthContext, error)
}

// DefaultAuthValidator provides basic authentication validation
type DefaultAuthValidator struct {
	serviceTokens map[string]string // service_name -> token
}

// NewDefaultAuthValidator creates a new default auth validator
func NewDefaultAuthValidator(serviceTokens map[string]string) *DefaultAuthValidator {
	return &DefaultAuthValidator{
		serviceTokens: serviceTokens,
	}
}

// ValidateToken validates user JWT tokens (placeholder implementation)
func (v *DefaultAuthValidator) ValidateToken(ctx context.Context, token string) (*AuthContext, error) {
	// TODO: Implement actual JWT validation
	// For now, just extract basic info from headers
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing metadata")
	}

	authCtx := &AuthContext{
		IsService: false,
	}

	// Extract user information from headers
	if userIDs := md.Get(UserIDKey); len(userIDs) > 0 {
		authCtx.UserID = userIDs[0]
	}
	if emails := md.Get(UserEmailKey); len(emails) > 0 {
		authCtx.UserEmail = emails[0]
	}
	if names := md.Get(UserNameKey); len(names) > 0 {
		authCtx.UserName = names[0]
	}

	return authCtx, nil
}

// ValidateServiceToken validates service-to-service tokens
func (v *DefaultAuthValidator) ValidateServiceToken(ctx context.Context, token string) (*AuthContext, error) {
	// Simple token validation - in production, use proper service authentication
	for serviceName, validToken := range v.serviceTokens {
		if token == validToken {
			return &AuthContext{
				ServiceToken: token,
				IsService:    true,
				UserName:     serviceName, // Use service name as identifier
			}, nil
		}
	}

	return nil, status.Error(codes.Unauthenticated, "invalid service token")
}

// UnaryAuthInterceptor validates authentication for unary requests
func UnaryAuthInterceptor() grpc.UnaryServerInterceptor {
	return UnaryAuthInterceptorWithValidator(nil)
}

// UnaryAuthInterceptorWithValidator validates authentication with custom validator
func UnaryAuthInterceptorWithValidator(validator AuthValidator) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// Skip auth for health checks
		if strings.Contains(info.FullMethod, "Health") {
			return handler(ctx, req)
		}

		authCtx, err := extractAndValidateAuth(ctx, validator)
		if err != nil {
			return nil, err
		}

		// Add auth context to the request context
		newCtx := context.WithValue(ctx, "auth", authCtx)
		return handler(newCtx, req)
	}
}

// StreamAuthInterceptor validates authentication for streaming requests
func StreamAuthInterceptor() grpc.StreamServerInterceptor {
	return StreamAuthInterceptorWithValidator(nil)
}

// StreamAuthInterceptorWithValidator validates authentication with custom validator
func StreamAuthInterceptorWithValidator(validator AuthValidator) grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		// Skip auth for health checks
		if strings.Contains(info.FullMethod, "Health") {
			return handler(srv, stream)
		}

		authCtx, err := extractAndValidateAuth(stream.Context(), validator)
		if err != nil {
			return err
		}

		// Wrap the stream with auth context
		wrappedStream := &authServerStream{
			ServerStream: stream,
			authCtx:      authCtx,
		}

		return handler(srv, wrappedStream)
	}
}

// UnaryClientAuthInterceptor adds authentication headers to client requests
func UnaryClientAuthInterceptor() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		// Add authentication headers from context
		newCtx := addClientAuthHeaders(ctx)
		return invoker(newCtx, method, req, reply, cc, opts...)
	}
}

// StreamClientAuthInterceptor adds authentication headers to client streaming requests
func StreamClientAuthInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		// Add authentication headers from context
		newCtx := addClientAuthHeaders(ctx)
		return streamer(newCtx, desc, cc, method, opts...)
	}
}

// extractAndValidateAuth extracts and validates authentication from context
func extractAndValidateAuth(ctx context.Context, validator AuthValidator) (*AuthContext, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing metadata")
	}

	// Check for service token first
	if serviceTokens := md.Get(ServiceTokenKey); len(serviceTokens) > 0 {
		if validator != nil {
			return validator.ValidateServiceToken(ctx, serviceTokens[0])
		}
		// Default service validation
		return &AuthContext{
			ServiceToken: serviceTokens[0],
			IsService:    true,
		}, nil
	}

	// Check for user authorization
	authHeaders := md.Get(AuthorizationKey)
	if len(authHeaders) == 0 {
		return nil, status.Error(codes.Unauthenticated, "missing authorization header")
	}

	authHeader := authHeaders[0]
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, status.Error(codes.Unauthenticated, "invalid authorization header format")
	}

	token := strings.TrimPrefix(authHeader, "Bearer ")
	if validator != nil {
		return validator.ValidateToken(ctx, token)
	}

	// Default token validation
	return &AuthContext{
		IsService: false,
	}, nil
}

// addClientAuthHeaders adds authentication headers to outgoing context
func addClientAuthHeaders(ctx context.Context) context.Context {
	// Check if auth context exists
	if authCtx, ok := ctx.Value("auth").(*AuthContext); ok {
		md := metadata.New(nil)

		if authCtx.IsService && authCtx.ServiceToken != "" {
			md.Set(ServiceTokenKey, authCtx.ServiceToken)
		} else {
			// Propagate user headers
			if authCtx.UserID != "" {
				md.Set(UserIDKey, authCtx.UserID)
			}
			if authCtx.UserEmail != "" {
				md.Set(UserEmailKey, authCtx.UserEmail)
			}
			if authCtx.UserName != "" {
				md.Set(UserNameKey, authCtx.UserName)
			}
		}

		return metadata.NewOutgoingContext(ctx, md)
	}

	return ctx
}

// authServerStream wraps a server stream with auth context
type authServerStream struct {
	grpc.ServerStream
	authCtx *AuthContext
}

func (s *authServerStream) Context() context.Context {
	return context.WithValue(s.ServerStream.Context(), "auth", s.authCtx)
}

// GetAuthFromContext extracts auth context from request context
func GetAuthFromContext(ctx context.Context) (*AuthContext, bool) {
	authCtx, ok := ctx.Value("auth").(*AuthContext)
	return authCtx, ok
}

// RequireAuth helper function to require authentication in handlers
func RequireAuth(ctx context.Context) (*AuthContext, error) {
	authCtx, ok := GetAuthFromContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "authentication required")
	}
	return authCtx, nil
}

// RequireUser helper function to require user authentication (not service)
func RequireUser(ctx context.Context) (*AuthContext, error) {
	authCtx, err := RequireAuth(ctx)
	if err != nil {
		return nil, err
	}
	if authCtx.IsService {
		return nil, status.Error(codes.PermissionDenied, "user authentication required")
	}
	if authCtx.UserID == "" {
		return nil, status.Error(codes.Unauthenticated, "valid user ID required")
	}
	return authCtx, nil
}

// RequireService helper function to require service authentication
func RequireService(ctx context.Context) (*AuthContext, error) {
	authCtx, err := RequireAuth(ctx)
	if err != nil {
		return nil, err
	}
	if !authCtx.IsService {
		return nil, status.Error(codes.PermissionDenied, "service authentication required")
	}
	return authCtx, nil
}

// WithAuth adds auth context to context for client requests
func WithAuth(ctx context.Context, authCtx *AuthContext) context.Context {
	return context.WithValue(ctx, "auth", authCtx)
}

// WithServiceAuth adds service auth context for client requests
func WithServiceAuth(ctx context.Context, serviceToken string) context.Context {
	return WithAuth(ctx, &AuthContext{
		ServiceToken: serviceToken,
		IsService:    true,
	})
}

// WithUserAuth adds user auth context for client requests
func WithUserAuth(ctx context.Context, userID, userEmail, userName string) context.Context {
	return WithAuth(ctx, &AuthContext{
		UserID:    userID,
		UserEmail: userEmail,
		UserName:  userName,
		IsService: false,
	})
}