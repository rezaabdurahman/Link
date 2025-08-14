.PHONY: help build run test clean docker-build docker-run migrate-up migrate migrate-down deps lint format

# Default target
help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# Build the application
build: ## Build the AI service
	@echo "Building ai-svc..."
	@go build -o bin/ai-svc ./cmd

# Run the application locally
run: ## Run the AI service locally
	@echo "Running ai-svc..."
	@go run ./cmd

# Run tests
test: ## Run all tests
	@echo "Running tests..."
	@go test -v ./...

# Run tests with coverage
test-coverage: ## Run tests with coverage report (≥60% target)
	@echo "Running tests with coverage..."
	@go test -v -coverprofile=coverage.out -covermode=count ./...
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"
	@go tool cover -func=coverage.out | tail -1 | awk '{print "Total coverage: " $$3}'

# Run unit tests only
test-unit: ## Run unit tests only
	@echo "Running unit tests..."
	@go test -v -short ./internal/...

# Run integration tests only
test-integration: ## Run integration tests only
	@echo "Running integration tests..."
	@go test -v -run Integration ./internal/integration/...

# Run tests with race detection
test-race: ## Run tests with race detection
	@echo "Running tests with race detection..."
	@go test -race -v ./...

# Run tests and check coverage threshold
test-coverage-check: ## Run tests and check coverage meets 60% threshold
	@echo "Running tests with coverage check..."
	@go test -v -coverprofile=coverage.out -covermode=count ./...
	@echo "Checking coverage threshold..."
	@awk -F'[ %]+' '/^total:/ {if ($$3 < 60.0) {print "Coverage " $$3 "% is below 60% threshold"; exit 1} else {print "Coverage " $$3 "% meets threshold"}}' <(go tool cover -func=coverage.out)

# Generate coverage badge data
test-coverage-badge: ## Generate coverage badge data for CI
	@echo "Generating coverage badge data..."
	@go test -v -coverprofile=coverage.out -covermode=count ./...
	@COVERAGE=$$(go tool cover -func=coverage.out | grep total | awk '{print $$3}' | sed 's/%//'); \
	echo "Coverage: $$COVERAGE%"; \
	if [ "$$CI" = "true" ]; then \
		echo "##vso[task.setvariable variable=coverage]$$COVERAGE"; \
	fi

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
	@docker build -t ai-svc:latest .

# Docker run
docker-run: ## Run Docker container
	@echo "Running Docker container..."
	@docker run --rm -p 8081:8081 --env-file .env ai-svc:latest

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

# Benchmark tests
bench: ## Run benchmark tests
	@echo "Running benchmarks..."
	@go test -bench=. -benchmem ./...

# Check for vulnerabilities
vuln-check: ## Check for known vulnerabilities
	@echo "Checking for vulnerabilities..."
	@govulncheck ./...

# AI service specific targets
ai-test: ## Test AI integration
	@echo "Testing AI integration..."
	@go test -v -tags=integration ./internal/service/ai_test.go

# Load test
load-test: ## Run load tests
	@echo "Running load tests..."
	@echo "Load testing requires additional setup - see docs/LOAD_TESTING.md"

# Docker and deployment targets
docker-build-multiarch: ## Build multi-architecture Docker image
	@echo "Building multi-architecture Docker image..."
	@docker buildx build --platform linux/amd64,linux/arm64 -t ai-svc:latest --push .

docker-scan: ## Scan Docker image for vulnerabilities
	@echo "Scanning Docker image for vulnerabilities..."
	@docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy:latest image ai-svc:latest

docker-sbom: ## Generate Software Bill of Materials for Docker image
	@echo "Generating SBOM..."
	@docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
		anchore/syft:latest ai-svc:latest

# Deployment targets
deploy-dev: ## Deploy to development environment
	@echo "Deploying to development..."
	@./scripts/deploy.sh development

deploy-dev-monitoring: ## Deploy to development with monitoring
	@echo "Deploying to development with monitoring..."
	@./scripts/deploy.sh development --monitoring

deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	@./scripts/deploy.sh staging --monitoring

deploy-prod: ## Deploy to production environment
	@echo "Deploying to production..."
	@./scripts/deploy.sh production --monitoring --logging

# Environment management
env-up: ## Start services with docker-compose (development)
	@echo "Starting development environment..."
	@docker-compose --env-file .env.development up -d

env-down: ## Stop all services
	@echo "Stopping all services..."
	@docker-compose --env-file .env.development down

env-logs: ## Show logs from all services
	@docker-compose --env-file .env.development logs -f

env-ps: ## Show running containers
	@docker-compose --env-file .env.development ps

env-clean: ## Clean up Docker resources
	@echo "Cleaning up Docker resources..."
	@docker-compose --env-file .env.development down -v --remove-orphans
	@docker system prune -f

# Database operations
db-migrate-up: ## Run database migrations up
	@echo "Running database migrations up..."
	@docker-compose --env-file .env.development run --rm ai-svc make migrate-up

db-migrate-down: ## Run database migrations down
	@echo "Running database migrations down..."
	@docker-compose --env-file .env.development run --rm ai-svc make migrate-down

db-shell: ## Open database shell
	@echo "Opening database shell..."
	@docker-compose --env-file .env.development exec postgres psql -U postgres -d ai_db_dev

db-backup: ## Backup database
	@echo "Creating database backup..."
	@docker-compose --env-file .env.development exec postgres pg_dump -U postgres ai_db_dev > backup_$$(date +%Y%m%d_%H%M%S).sql

# Redis operations
redis-shell: ## Open Redis shell
	@echo "Opening Redis shell..."
	@docker-compose --env-file .env.development exec redis redis-cli

redis-flush: ## Flush Redis cache
	@echo "Flushing Redis cache..."
	@docker-compose --env-file .env.development exec redis redis-cli FLUSHALL
