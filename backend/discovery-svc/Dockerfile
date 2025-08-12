# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Ensure migrations directory is included
COPY migrations/ ./migrations/

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
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 8080

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
