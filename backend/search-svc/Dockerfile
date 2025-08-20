# Build stage
FROM golang:1.23-alpine AS builder

# Set working directory
WORKDIR /app

# Install git and ca-certificates for Go module dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy shared libs and go mod and sum files
COPY shared-libs ./shared-libs
COPY search-svc/go.mod search-svc/go.sum ./

# Copy source code
COPY search-svc/ .

# Tidy dependencies and download
RUN go mod tidy && go mod download

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o search-svc ./main.go

# Build migration CLI
RUN cd shared-libs && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o migrate ./migrations/cmd/migrate

# Final stage
FROM alpine:3.20.3

# Install required tools for database connectivity and healthchecks
RUN apk --no-cache add ca-certificates netcat-openbsd wget

# Create non-root user
RUN adduser -D -s /bin/sh -u 10001 appuser

# Set working directory
WORKDIR /app

# Copy binaries from builder stage
COPY --from=builder --chown=appuser:appuser /app/search-svc .
COPY --from=builder --chown=appuser:appuser /app/shared-libs/migrate .

# Copy migrations directory
COPY search-svc/migrations ./migrations

# Copy entrypoint script
COPY search-svc/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Change ownership of all files
RUN chown -R appuser:appuser /app/

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
CMD ["./search-svc"]
