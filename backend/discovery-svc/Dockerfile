# Dependencies stage - for better layer caching
FROM golang:1.23-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files first for better caching
COPY shared-libs/go.mod shared-libs/go.sum ./shared-libs/
COPY discovery-svc/go.mod discovery-svc/go.sum ./

# Download dependencies (cached unless go.mod/go.sum changes)
RUN go mod download

# Build stage
FROM deps AS builder

# Copy source code
COPY shared-libs/ ./shared-libs/
COPY discovery-svc/ .

# Tidy and ensure all dependencies
RUN go mod tidy

# Ensure migrations directory is included
COPY discovery-svc/migrations/ ./migrations/

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o discovery-svc ./cmd/server

# Build the migration tool with optimizations  
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o migrate ./cmd/migrate

# Final stage - minimal production image
FROM alpine:latest AS production

RUN apk --no-cache add ca-certificates tzdata netcat-openbsd

WORKDIR /root/

# Copy the binaries from builder stage
COPY --from=builder /app/discovery-svc .
COPY --from=builder /app/migrate .

# Copy migrations
COPY --from=builder /app/migrations/ ./migrations/

# Copy entrypoint script
COPY discovery-svc/docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 8080

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
