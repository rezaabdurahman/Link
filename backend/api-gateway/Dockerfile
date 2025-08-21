# Build stage
FROM golang:1.23-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache git ca-certificates tzdata

# Copy shared libs to parent directory structure
COPY shared-libs ../shared-libs

# Copy go mod files
COPY api-gateway/go.mod api-gateway/go.sum ./

# Copy source code  
COPY api-gateway/ .

# Tidy dependencies and download
RUN go mod tidy && go mod download

# Build the integrated API Gateway application (combines legacy + enhanced features)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/gateway/integrated_main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates tzdata

# Set working directory
WORKDIR /root/

# Copy binary from builder stage
COPY --from=builder /app/main .

# Copy documentation files if they exist (commented out as docs don't exist yet)
# COPY --from=builder /app/docs ./docs/

# Create non-root user for security
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

# Change ownership
RUN chown -R appuser:appuser .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
CMD ["./main"]
