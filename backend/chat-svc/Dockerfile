# Dependencies stage - for better layer caching
FROM golang:1.23-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy all required dependencies
COPY shared-libs/ ./shared-libs/
COPY proto/ ./proto/
COPY chat-svc/go.mod chat-svc/go.sum ./chat-svc/

# Work from chat-svc directory to maintain relative paths
WORKDIR /app/chat-svc

# Download dependencies (cached unless go.mod/go.sum changes)
RUN go mod download

# Build stage
FROM deps AS builder

# Copy remaining source code
COPY chat-svc/ .

# Tidy and ensure all dependencies
RUN go mod tidy

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o chat-svc ./cmd

# Install golang-migrate tool as fallback (while shared-libs has build issues)
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Final stage - minimal production image
FROM alpine:latest AS production

# Install required tools for database connectivity and healthchecks
RUN apk --no-cache add ca-certificates tzdata netcat-openbsd wget

# Set working directory
WORKDIR /root/

# Copy binaries from builder stage
COPY --from=builder /app/chat-svc/chat-svc .
COPY --from=builder /go/bin/migrate .

# Copy migrations directory
COPY chat-svc/migrations ./migrations

# Copy entrypoint script
COPY chat-svc/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

# Change ownership of all files
RUN chown -R appuser:appuser /root/

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8082

# Health check with longer startup time for migrations - using correct endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8082/health/live || exit 1

# Use entrypoint to handle migrations
ENTRYPOINT ["./docker-entrypoint.sh"]

# Run the application
CMD ["./chat-svc"]
