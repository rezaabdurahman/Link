# Dependencies stage - for better layer caching
FROM golang:1.23-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files first for better caching
COPY shared-libs/go.mod shared-libs/go.sum ./shared-libs/
COPY user-svc/go.mod user-svc/go.sum ./

# Download dependencies (cached unless go.mod/go.sum changes)
RUN go mod download

# Build stage
FROM deps AS builder

# Copy source code
COPY shared-libs/ ./shared-libs/
COPY user-svc/ .

# Tidy and ensure all dependencies
RUN go mod tidy

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o main .

# Build migration CLI
RUN cd shared-libs && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o migrate ./migrations/cmd/migrate

# Final stage - minimal production image
FROM alpine:latest AS production

# Install required tools for database connectivity and healthchecks
RUN apk --no-cache add ca-certificates tzdata netcat-openbsd wget

# Set working directory
WORKDIR /root/

# Copy binaries from builder stage
COPY --from=builder /app/main .
COPY --from=builder /app/shared-libs/migrate .

# Copy migrations directory
COPY user-svc/migrations ./migrations

# Copy entrypoint script
COPY user-svc/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

# Change ownership of all files
RUN chown -R appuser:appuser /root/

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check with longer startup time for migrations
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Use entrypoint to handle migrations
ENTRYPOINT ["./docker-entrypoint.sh"]

# Run the application
CMD ["./main"]
