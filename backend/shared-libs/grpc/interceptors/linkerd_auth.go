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
	// Linkerd identity metadata keys
	LinkerdClientIDKey = "l5d-client-id"
	LinkerdRemoteIPKey = "l5d-remote-ip"
	
	// Service context metadata keys
	ServiceNameKey     = "x-service-name"
	ServiceIdentityKey = "x-linkerd-identity"
	RequestTypeKey     = "x-request-type"
	
	// User context metadata keys (for user requests)
	UserRolesKey = "x-user-roles"
)

// LinkerdAuthContext holds authentication information from Linkerd service mesh
type LinkerdAuthContext struct {
	// Service identity (from Linkerd)
	ServiceName        string
	LinkerdIdentity    string
	IsServiceRequest   bool
	
	// User context (if request originated from user)
	UserID             string
	UserEmail          string
	UserName           string
	UserRoles          []string
	IsUserRequest      bool
	
	// Request metadata
	RequestType        string
	ClientIP           string
}

// LinkerdAuthInterceptor provides gRPC authentication using Linkerd service mesh identity
func LinkerdAuthInterceptor() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		// Extract metadata from the incoming request
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Errorf(codes.Unauthenticated, "missing metadata")
		}

		// Create authentication context
		authCtx := extractLinkerdAuthContext(md)
		
		// Validate the authentication context
		if err := validateLinkerdAuth(authCtx, info.FullMethod); err != nil {
			return nil, err
		}

		// Add authentication context to the request context
		ctxWithAuth := context.WithValue(ctx, "linkerd_auth", authCtx)
		
		// Call the handler with the authenticated context
		return handler(ctxWithAuth, req)
	}
}

// LinkerdAuthStreamInterceptor provides gRPC stream authentication using Linkerd
func LinkerdAuthStreamInterceptor() grpc.StreamServerInterceptor {
	return func(
		srv interface{},
		stream grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		// Extract metadata from the stream context
		md, ok := metadata.FromIncomingContext(stream.Context())
		if !ok {
			return status.Errorf(codes.Unauthenticated, "missing metadata")
		}

		// Create authentication context
		authCtx := extractLinkerdAuthContext(md)
		
		// Validate the authentication context
		if err := validateLinkerdAuth(authCtx, info.FullMethod); err != nil {
			return err
		}

		// Create a wrapped stream with authentication context
		wrappedStream := &authContextStream{
			ServerStream: stream,
			authContext:  authCtx,
		}
		
		return handler(srv, wrappedStream)
	}
}

// extractLinkerdAuthContext extracts authentication information from gRPC metadata
func extractLinkerdAuthContext(md metadata.MD) *LinkerdAuthContext {
	authCtx := &LinkerdAuthContext{}
	
	// Extract Linkerd service identity
	if clientIDs := md.Get(LinkerdClientIDKey); len(clientIDs) > 0 {
		authCtx.LinkerdIdentity = clientIDs[0]
		authCtx.ServiceName = extractServiceNameFromLinkerdIdentity(clientIDs[0])
		authCtx.IsServiceRequest = true
	}
	
	// Extract service context (from API Gateway)
	if serviceNames := md.Get(ServiceNameKey); len(serviceNames) > 0 {
		if authCtx.ServiceName == "" {
			authCtx.ServiceName = serviceNames[0]
		}
	}
	
	if identities := md.Get(ServiceIdentityKey); len(identities) > 0 {
		if authCtx.LinkerdIdentity == "" {
			authCtx.LinkerdIdentity = identities[0]
		}
	}
	
	// Extract request type
	if requestTypes := md.Get(RequestTypeKey); len(requestTypes) > 0 {
		authCtx.RequestType = requestTypes[0]
		authCtx.IsUserRequest = requestTypes[0] == "user"
		authCtx.IsServiceRequest = requestTypes[0] == "service"
	}
	
	// Extract user context (if user request)
	if userIDs := md.Get(UserIDKey); len(userIDs) > 0 {
		authCtx.UserID = userIDs[0]
		authCtx.IsUserRequest = true
	}
	
	if userEmails := md.Get(UserEmailKey); len(userEmails) > 0 {
		authCtx.UserEmail = userEmails[0]
	}
	
	if userNames := md.Get(UserNameKey); len(userNames) > 0 {
		authCtx.UserName = userNames[0]
	}
	
	if userRoles := md.Get(UserRolesKey); len(userRoles) > 0 {
		authCtx.UserRoles = strings.Split(userRoles[0], ",")
	}
	
	// Extract client IP
	if remoteIPs := md.Get(LinkerdRemoteIPKey); len(remoteIPs) > 0 {
		authCtx.ClientIP = remoteIPs[0]
	}
	
	return authCtx
}

// validateLinkerdAuth validates the authentication context
func validateLinkerdAuth(authCtx *LinkerdAuthContext, fullMethod string) error {
	// Check if this is a public method that doesn't require authentication
	if isPublicMethod(fullMethod) {
		return nil
	}
	
	// Require either user authentication or service authentication
	if !authCtx.IsUserRequest && !authCtx.IsServiceRequest {
		return status.Errorf(codes.Unauthenticated, "authentication required")
	}
	
	// If service request, validate service identity
	if authCtx.IsServiceRequest {
		if authCtx.ServiceName == "" {
			return status.Errorf(codes.Unauthenticated, "service identity required")
		}
		
		if !isKnownService(authCtx.ServiceName) {
			return status.Errorf(codes.PermissionDenied, "unknown service: %s", authCtx.ServiceName)
		}
	}
	
	// If user request, validate user context
	if authCtx.IsUserRequest {
		if authCtx.UserID == "" {
			return status.Errorf(codes.Unauthenticated, "user identity required")
		}
	}
	
	return nil
}

// extractServiceNameFromLinkerdIdentity extracts service name from Linkerd client ID
func extractServiceNameFromLinkerdIdentity(clientID string) string {
	// Expected format: link-<service>-service-sa.link-services.serviceaccount.identity.linkerd.cluster.local
	parts := strings.Split(clientID, ".")
	if len(parts) == 0 {
		return ""
	}
	
	serviceAccount := parts[0]
	
	// Map service accounts to service names
	serviceAccountMappings := map[string]string{
		"link-api-gateway-sa":     "api-gateway",
		"link-user-service-sa":    "user-svc",
		"link-chat-service-sa":    "chat-svc",
		"link-ai-service-sa":      "ai-svc",
		"link-discovery-service-sa": "discovery-svc",
		"link-search-service-sa":  "search-svc",
		"link-feature-service-sa": "feature-svc",
	}
	
	if serviceName, exists := serviceAccountMappings[serviceAccount]; exists {
		return serviceName
	}
	
	return ""
}

// isPublicMethod checks if a gRPC method is public (doesn't require auth)
func isPublicMethod(fullMethod string) bool {
	publicMethods := []string{
		"/health.v1.Health/Check",
		"/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo",
	}
	
	for _, public := range publicMethods {
		if fullMethod == public {
			return true
		}
	}
	
	return false
}

// isKnownService checks if a service name is known/allowed
func isKnownService(serviceName string) bool {
	knownServices := []string{
		"api-gateway",
		"user-svc",
		"chat-svc",
		"ai-svc",
		"discovery-svc",
		"search-svc",
		"feature-svc",
	}
	
	for _, known := range knownServices {
		if serviceName == known {
			return true
		}
	}
	
	return false
}

// authContextStream wraps a gRPC stream with authentication context
type authContextStream struct {
	grpc.ServerStream
	authContext *LinkerdAuthContext
}

// Context returns the stream context with authentication information
func (s *authContextStream) Context() context.Context {
	return context.WithValue(s.ServerStream.Context(), "linkerd_auth", s.authContext)
}

// GetLinkerdAuthContext extracts authentication context from gRPC context
func GetLinkerdAuthContext(ctx context.Context) (*LinkerdAuthContext, bool) {
	authCtx, ok := ctx.Value("linkerd_auth").(*LinkerdAuthContext)
	return authCtx, ok
}

// RequireServiceAuth middleware that requires service authentication for gRPC methods
func RequireServiceAuth(allowedServices ...string) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		authCtx, ok := GetLinkerdAuthContext(ctx)
		if !ok {
			return nil, status.Errorf(codes.Internal, "authentication context missing")
		}
		
		if !authCtx.IsServiceRequest {
			return nil, status.Errorf(codes.PermissionDenied, "service authentication required")
		}
		
		if len(allowedServices) > 0 {
			allowed := false
			for _, allowedService := range allowedServices {
				if authCtx.ServiceName == allowedService {
					allowed = true
					break
				}
			}
			if !allowed {
				return nil, status.Errorf(codes.PermissionDenied, 
					"service %s not authorized", authCtx.ServiceName)
			}
		}
		
		return handler(ctx, req)
	}
}

// RequireUserAuth middleware that requires user authentication for gRPC methods
func RequireUserAuth() grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		authCtx, ok := GetLinkerdAuthContext(ctx)
		if !ok {
			return nil, status.Errorf(codes.Internal, "authentication context missing")
		}
		
		if !authCtx.IsUserRequest {
			return nil, status.Errorf(codes.PermissionDenied, "user authentication required")
		}
		
		if authCtx.UserID == "" {
			return nil, status.Errorf(codes.Unauthenticated, "user identity required")
		}
		
		return handler(ctx, req)
	}
}