# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy shared libs and go mod and sum files
COPY shared-libs ./shared-libs
COPY discovery-svc/go.mod discovery-svc/go.sum ./

# Copy source code
COPY discovery-svc/ .

# Tidy dependencies and download
RUN go mod tidy && go mod download

# Ensure migrations directory is included
COPY discovery-svc/migrations/ ./migrations/

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o discovery-svc .

# Build the migration tool
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o migrate ./cmd/migrate

# Production stage
FROM alpine:latest

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
