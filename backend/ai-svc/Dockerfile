# Build stage
FROM golang:1.23-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache git ca-certificates tzdata

# Copy shared libs and go mod files first for better Docker layer caching
COPY shared-libs ./shared-libs
COPY ai-svc/go.mod ai-svc/go.sum ./

# Copy source code
COPY ai-svc/ .

# Tidy dependencies and download
RUN go mod tidy && go mod download

# Ensure migrations directory is included
COPY ai-svc/migrations/ ./migrations/

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

# Final stage - using scratch for minimal image size
FROM alpine:latest

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
COPY ai-svc/docker-entrypoint.sh .
USER root
RUN chmod +x docker-entrypoint.sh

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8081

# Health check - using comprehensive health endpoint with DB & Redis checks
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
