package interceptors

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
)

// UnaryLoggingInterceptor logs gRPC unary requests and responses
func UnaryLoggingInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()
		
		// Get client information
		clientIP := "unknown"
		if p, ok := peer.FromContext(ctx); ok {
			clientIP = p.Addr.String()
		}

		// Log request
		fmt.Printf("[gRPC] %s - %s - START\n", info.FullMethod, clientIP)

		// Call the handler
		resp, err := handler(ctx, req)

		// Log response
		duration := time.Since(start)
		statusCode := status.Code(err)
		
		fmt.Printf("[gRPC] %s - %s - %v - %s\n", 
			info.FullMethod, 
			clientIP, 
			statusCode, 
			duration,
		)

		if err != nil {
			fmt.Printf("[gRPC] Error: %v\n", err)
		}

		return resp, err
	}
}

// StreamLoggingInterceptor logs gRPC streaming requests
func StreamLoggingInterceptor() grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		start := time.Now()
		
		// Get client information
		clientIP := "unknown"
		if p, ok := peer.FromContext(stream.Context()); ok {
			clientIP = p.Addr.String()
		}

		// Log stream start
		fmt.Printf("[gRPC Stream] %s - %s - START\n", info.FullMethod, clientIP)

		// Call the handler
		err := handler(srv, stream)

		// Log stream end
		duration := time.Since(start)
		statusCode := status.Code(err)
		
		fmt.Printf("[gRPC Stream] %s - %s - %v - %s\n", 
			info.FullMethod, 
			clientIP, 
			statusCode, 
			duration,
		)

		if err != nil {
			fmt.Printf("[gRPC Stream] Error: %v\n", err)
		}

		return err
	}
}

// UnaryClientLoggingInterceptor logs gRPC client requests
func UnaryClientLoggingInterceptor() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		start := time.Now()
		
		fmt.Printf("[gRPC Client] %s - START\n", method)

		// Make the call
		err := invoker(ctx, method, req, reply, cc, opts...)

		// Log result
		duration := time.Since(start)
		statusCode := status.Code(err)
		
		fmt.Printf("[gRPC Client] %s - %v - %s\n", 
			method, 
			statusCode, 
			duration,
		)

		if err != nil {
			fmt.Printf("[gRPC Client] Error: %v\n", err)
		}

		return err
	}
}

// StreamClientLoggingInterceptor logs gRPC client streaming requests
func StreamClientLoggingInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		start := time.Now()
		
		fmt.Printf("[gRPC Client Stream] %s - START\n", method)

		// Create the stream
		stream, err := streamer(ctx, desc, cc, method, opts...)

		if err != nil {
			duration := time.Since(start)
			statusCode := status.Code(err)
			
			fmt.Printf("[gRPC Client Stream] %s - %v - %s\n", 
				method, 
				statusCode, 
				duration,
			)
			fmt.Printf("[gRPC Client Stream] Error: %v\n", err)
			return nil, err
		}

		return &loggedClientStream{
			ClientStream: stream,
			method:       method,
			start:        start,
		}, nil
	}
}

type loggedClientStream struct {
	grpc.ClientStream
	method string
	start  time.Time
}

func (s *loggedClientStream) CloseSend() error {
	err := s.ClientStream.CloseSend()
	
	duration := time.Since(s.start)
	statusCode := status.Code(err)
	
	fmt.Printf("[gRPC Client Stream] %s - %v - %s - CLOSE_SEND\n", 
		s.method, 
		statusCode, 
		duration,
	)

	if err != nil {
		fmt.Printf("[gRPC Client Stream] CloseSend Error: %v\n", err)
	}

	return err
}