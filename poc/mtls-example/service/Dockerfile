FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

FROM alpine:latest

# Install ca-certificates for SSL/TLS
RUN apk --no-cache add ca-certificates curl

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Create certs directory
RUN mkdir -p /certs

# Expose port
EXPOSE 8443

# Health check using curl with client cert
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --cert /certs/service.crt --key /certs/service.key --cacert /certs/ca-bundle.crt \
        --fail --silent --show-error https://localhost:8443/health || exit 1

CMD ["./main"]
