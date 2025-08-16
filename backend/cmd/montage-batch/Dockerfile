# Build stage
FROM golang:1.21-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the montage batch binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o montage-batch ./cmd/montage-batch

# Production stage
FROM alpine:3.18

# Install required packages for cron and health checks
RUN apk add --no-cache ca-certificates tzdata curl

# Create app user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/montage-batch .

# Copy cron configuration if needed
COPY --from=builder /app/cmd/montage-batch/crontab /etc/cron.d/montage-batch

# Set permissions
RUN chmod +x /app/montage-batch
RUN chmod 0644 /etc/cron.d/montage-batch || true

# Create log directory
RUN mkdir -p /var/log/montage-batch && \
    chown -R appuser:appgroup /var/log/montage-batch

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /app/montage-batch health || exit 1

# Switch to non-root user
USER appuser

# Default environment variables
ENV BATCH_MODE=once
ENV LOG_LEVEL=info
ENV ENVIRONMENT=production

# Expose port for health checks (if needed)
EXPOSE 8090

# Default command - run batch job once
CMD ["/app/montage-batch"]
