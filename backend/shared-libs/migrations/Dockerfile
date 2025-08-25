# Multi-stage build for migration tool
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy migration source code
COPY . .

# Build the migration binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o migrate ./cmd/migrate

# Final lightweight image
FROM alpine:3.19

# Install CA certificates for SSL connections
RUN apk --no-cache add ca-certificates postgresql-client

WORKDIR /root/

# Copy the migration binary
COPY --from=builder /app/migrate .

# Copy migration files (will be overridden by volume mounts)
COPY --from=builder /app/migrations ./migrations

# Make the binary executable
RUN chmod +x ./migrate

# Default command
ENTRYPOINT ["./migrate"]
CMD ["-help"]