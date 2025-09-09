# Dependencies stage - for better layer caching
FROM golang:1.23-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy entire source for dependency resolution
COPY shared-libs/ ./shared-libs/
COPY proto/ ./proto/
COPY user-svc/ ./user-svc/

# Change to user-svc directory and download dependencies
WORKDIR /app/user-svc
# Set environment variables to force local module resolution
ENV GONOPROXY=github.com/link-app
ENV GONOSUMDB=github.com/link-app
ENV GOPRIVATE=github.com/link-app
RUN go mod download

# Build stage
FROM deps AS builder

# Set environment variables for build stage
ENV GONOPROXY=github.com/link-app
ENV GONOSUMDB=github.com/link-app
ENV GOPRIVATE=github.com/link-app

# Build the application with optimizations  
RUN CGO_ENABLED=0 GOOS=linux GOPROXY=direct GOSUMDB=off go build \
    -mod=mod \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o main ./cmd/server

# Build migration CLI
RUN cd ../shared-libs && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o migrate ./migrations/cmd/migrate

# Final stage - minimal production image
FROM alpine:latest AS production

# Install required tools for database connectivity and healthchecks
RUN apk --no-cache add ca-certificates tzdata netcat-openbsd wget

# Set working directory
WORKDIR /root/

# Copy binaries from builder stage
COPY --from=builder /app/user-svc/main .
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
