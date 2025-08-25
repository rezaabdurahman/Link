# Dependencies stage - for better layer caching
FROM golang:1.23-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files first for better caching
COPY shared-libs/go.mod shared-libs/go.sum ./shared-libs/
COPY chat-svc/go.mod chat-svc/go.sum ./

# Download dependencies (cached unless go.mod/go.sum changes)
RUN go mod download

# Build stage
FROM deps AS builder

# Copy source code
COPY shared-libs/ ./shared-libs/
COPY chat-svc/ .

# Tidy and ensure all dependencies
RUN go mod tidy

# Ensure migrations directory is included
COPY chat-svc/migrations/ ./migrations/

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -a -installsuffix cgo \
    -ldflags='-w -s -extldflags "-static"' \
    -o main ./cmd

# Build the migration tool
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -a -installsuffix cgo \
    -ldflags='-w -s -extldflags "-static"' \
    -o migrate ./cmd/migrate

# Final stage - minimal production image
FROM alpine:latest AS production

# Install minimal runtime dependencies
RUN apk --no-cache add ca-certificates tzdata wget netcat-openbsd

# Create non-root user for security
RUN addgroup -g 1001 appuser && \
    adduser -u 1001 -G appuser -s /bin/sh -D appuser

# Set working directory
WORKDIR /app

# Copy binaries from builder stage with correct ownership
COPY --from=builder --chown=appuser:appuser /app/main .
COPY --from=builder --chown=appuser:appuser /app/migrate .

# Copy migrations
COPY --from=builder --chown=appuser:appuser /app/migrations/ ./migrations/

# Copy entrypoint script
COPY chat-svc/docker-entrypoint.sh .
USER root
RUN chmod +x docker-entrypoint.sh

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check - using comprehensive health endpoint with DB & Redis checks
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
