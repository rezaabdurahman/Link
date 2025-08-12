.PHONY: help build run test clean docker-build docker-run migrate-up migrate migrate-down deps lint format

# Default target
help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Build the application
build: ## Build the chat service
	@echo "Building chat-svc..."
	@go build -o bin/chat-svc ./cmd

# Run the application locally
run: ## Run the chat service locally
	@echo "Running chat-svc..."
	@go run ./cmd

# Run tests
test: ## Run all tests
	@echo "Running tests..."
	@go test -v ./...

# Run tests with coverage
test-coverage: ## Run tests with coverage report
	@echo "Running tests with coverage..."
	@go test -v -coverprofile=coverage.out ./...
	@go tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -rf bin/
	@rm -f coverage.out coverage.html

# Install dependencies
deps: ## Download dependencies
	@echo "Downloading dependencies..."
	@go mod download
	@go mod tidy

# Lint code
lint: ## Run golangci-lint
	@echo "Running linter..."
	@golangci-lint run

# Format code
format: ## Format Go code
	@echo "Formatting code..."
	@go fmt ./...
	@goimports -w .

# Docker build
docker-build: ## Build Docker image
	@echo "Building Docker image..."
	@docker build -t chat-svc:latest .

# Docker run
docker-run: ## Run Docker container
	@echo "Running Docker container..."
	@docker run --rm -p 8080:8080 --env-file .env chat-svc:latest

# Database migrations up
migrate-up: ## Run database migrations up
	@echo "Running migrations up..."
	@migrate -path ./migrations -database "postgresql://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=$(DB_SSL_MODE)" up

# Database migrations (alias for migrate-up)
migrate: ## Run database migrations up
	@echo "Running migrations up..."
	@migrate -path ./migrations -database "postgresql://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=$(DB_SSL_MODE)" up

# Database migrations down
migrate-down: ## Run database migrations down
	@echo "Running migrations down..."
	@migrate -path ./migrations -database "postgresql://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=$(DB_SSL_MODE)" down

# Create new migration
migrate-create: ## Create new migration (make migrate-create name=migration_name)
	@echo "Creating migration: $(name)"
	@migrate create -ext sql -dir ./migrations $(name)

# Development setup
dev-setup: ## Set up development environment
	@echo "Setting up development environment..."
	@cp .env.example .env
	@echo "Please edit .env file with your configuration"

# Start development with hot reload (requires air)
dev: ## Start development server with hot reload
	@echo "Starting development server..."
	@air

# Generate OpenAPI documentation
docs: ## Generate API documentation
	@echo "Generating API documentation..."
	@swag init -g cmd/main.go -o ./docs

# Security scan
security-scan: ## Run security scan with gosec
	@echo "Running security scan..."
	@gosec ./...
