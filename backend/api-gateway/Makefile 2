# =================================================================
# Link API Gateway - Makefile
# Development and deployment automation
# =================================================================

.PHONY: help build test dev up down logs clean docker-build docker-push deps lint fmt

# Default target
help: ## Show this help message
	@echo "Link API Gateway - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Variables
APP_NAME := link-api-gateway
VERSION := 2.0.0
GO_VERSION := 1.21
DOCKER_REGISTRY := your-registry.amazonaws.com
PROJECT_ROOT := ../..

# Development
deps: ## Install Go dependencies
	go mod download
	go mod tidy

fmt: ## Format Go code
	go fmt ./...
	goimports -w .

lint: ## Run Go linters
	golangci-lint run ./...

test: ## Run all tests
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

test-integration: ## Run integration tests only
	go test -v -race ./internal/handlers -run TestIntegratedProxyHandler

test-config: ## Run configuration tests only
	go test -v -race ./internal/config

build: ## Build the application
	CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bin/main cmd/gateway/integrated_main.go

dev: ## Start development environment with hot reload
	air -c .air.toml

# Docker Development (standalone)
docker-build: ## Build Docker image
	docker build -t $(APP_NAME):$(VERSION) .
	docker build -t $(APP_NAME):latest .

docker-run: ## Run Docker container locally
	docker run --rm -p 8080:8080 --env-file .env.development $(APP_NAME):latest

# Docker Compose (with existing infrastructure)
up: ## Start services with main project infrastructure
	@echo "Starting enhanced API Gateway with existing infrastructure..."
	cd $(PROJECT_ROOT) && docker-compose -f docker-compose.yml -f backend/api-gateway/docker-compose.override.yml up -d

down: ## Stop all services
	@echo "Stopping services..."
	cd $(PROJECT_ROOT) && docker-compose -f docker-compose.yml -f backend/api-gateway/docker-compose.override.yml down

up-standalone: ## Start API Gateway standalone for development
	@echo "Starting API Gateway in standalone mode..."
	docker-compose -f docker-compose.yml up -d

down-standalone: ## Stop standalone services
	docker-compose -f docker-compose.yml down

logs: ## View logs
	cd $(PROJECT_ROOT) && docker-compose -f docker-compose.yml -f backend/api-gateway/docker-compose.override.yml logs -f api-gateway

logs-standalone: ## View standalone logs
	docker-compose -f docker-compose.yml logs -f api-gateway

# Monitoring
monitoring-up: ## Start monitoring stack
	cd $(PROJECT_ROOT) && docker-compose -f monitoring/docker-compose.monitoring.yml up -d

monitoring-down: ## Stop monitoring stack
	cd $(PROJECT_ROOT) && docker-compose -f monitoring/docker-compose.monitoring.yml down

monitoring-logs: ## View monitoring logs
	cd $(PROJECT_ROOT) && docker-compose -f monitoring/docker-compose.monitoring.yml logs -f

# Health checks
health: ## Check API Gateway health
	@curl -f http://localhost:8080/health || echo "API Gateway is not responding"

metrics: ## View Prometheus metrics
	@curl -s http://localhost:8080/metrics | head -20

# Cleanup
clean: ## Clean build artifacts and Docker containers
	rm -rf bin/
	rm -f coverage.out coverage.html
	docker system prune -f
	docker volume prune -f

clean-all: ## Clean everything including volumes
	make clean
	docker-compose -f docker-compose.yml down -v
	cd $(PROJECT_ROOT) && docker-compose -f docker-compose.yml -f backend/api-gateway/docker-compose.override.yml down -v

# AWS ECR (Production)
ecr-login: ## Login to AWS ECR
	aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin $(DOCKER_REGISTRY)

docker-push: ecr-login ## Build and push to ECR
	docker build -t $(DOCKER_REGISTRY)/$(APP_NAME):$(VERSION) .
	docker build -t $(DOCKER_REGISTRY)/$(APP_NAME):latest .
	docker push $(DOCKER_REGISTRY)/$(APP_NAME):$(VERSION)
	docker push $(DOCKER_REGISTRY)/$(APP_NAME):latest

# Development Workflows
dev-setup: ## Setup development environment
	@echo "Setting up development environment..."
	make deps
	make fmt
	make test
	@echo "Creating necessary directories..."
	mkdir -p logs tmp
	@echo "Development environment ready!"

dev-reset: ## Reset development environment
	make down
	make clean-all
	make dev-setup
	make up

# Integration with main project
project-up: ## Start entire project with enhanced API Gateway
	@echo "Starting entire Link project with enhanced API Gateway..."
	cd $(PROJECT_ROOT) && docker-compose -f docker-compose.yml -f backend/api-gateway/docker-compose.override.yml -f monitoring/docker-compose.monitoring.yml up -d
	@echo "Waiting for services to be healthy..."
	sleep 30
	make health
	@echo "Project is running at:"
	@echo "  API Gateway: http://localhost:8080"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Grafana: http://localhost:3001"
	@echo "  Prometheus: http://localhost:9090"

project-down: ## Stop entire project
	cd $(PROJECT_ROOT) && docker-compose -f docker-compose.yml -f backend/api-gateway/docker-compose.override.yml -f monitoring/docker-compose.monitoring.yml down

project-logs: ## View all project logs
	cd $(PROJECT_ROOT) && docker-compose -f docker-compose.yml -f backend/api-gateway/docker-compose.override.yml -f monitoring/docker-compose.monitoring.yml logs -f

# Deployment helpers
deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	# Add staging deployment commands here

deploy-prod: ## Deploy to production environment
	@echo "Deploying to production..."
	# Add production deployment commands here
