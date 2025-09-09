# Link Project - Master Operational Interface
# Provides unified commands for all development, testing, and deployment operations
#
# Usage: make <target>
# Run 'make help' for available commands

.PHONY: help dev test deploy monitor security clean

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "$(GREEN)Link Project - Available Commands$(NC)"
	@echo "=================================="
	@echo ""
	@echo "$(BLUE)Development:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; category=""} /^## / {category=$$0; gsub(/^## /, "", category); print "\n$(BLUE)" category ":$(NC)"} /^[a-zA-Z_-]+:.*##/ && !/^##/ {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Development Commands

dev-setup: ## One-time development environment setup
	@echo "$(GREEN)Setting up development environment...$(NC)"
	@./scripts/dev/setup.sh

dev-start: ## Start all services in development mode
	@echo "$(GREEN)Starting development services...$(NC)"
	@./scripts/dev/start.sh $(filter-out $@,$(MAKECMDGOALS))

dev-start-backend: ## Start only backend services
	@echo "$(GREEN)Starting backend services only...$(NC)"
	@./scripts/dev/start.sh --backend-only

dev-start-service: ## Start specific service (usage: make dev-start-service SERVICE=user-svc)
	@./scripts/dev/start.sh $(SERVICE)

dev-stop: ## Stop all development services
	@echo "$(YELLOW)Stopping development services...$(NC)"
	@cd backend && docker-compose down

dev-reset: ## Reset development environment (clean state)
	@echo "$(RED)Resetting development environment...$(NC)"
	@./scripts/dev/reset.sh

## Testing Commands

test: ## Run all test suites
	@echo "$(GREEN)Running complete test suite...$(NC)"
	@$(MAKE) test-unit
	@$(MAKE) test-integration
	@$(MAKE) test-security

test-unit: ## Run unit tests (backend + frontend)
	@echo "$(GREEN)Running unit tests...$(NC)"
	@cd backend && make test
	@cd frontend && npm run test

test-integration: ## Run integration test suite
	@echo "$(GREEN)Running integration tests...$(NC)"
	@./scripts/test/integration.sh

test-security: ## Run security test suite
	@echo "$(GREEN)Running security tests...$(NC)"
	@./scripts/test/security.sh

test-performance: ## Run performance benchmarks
	@echo "$(GREEN)Running performance tests...$(NC)"
	@./scripts/test/performance.sh

test-smoke: ## Run smoke tests
	@echo "$(GREEN)Running smoke tests...$(NC)"
	@./scripts/test/smoke.sh

test-coverage: ## Generate test coverage report
	@echo "$(GREEN)Generating test coverage...$(NC)"
	@cd frontend && npm run test:coverage

## Build Commands

build: ## Build all services and frontend
	@echo "$(GREEN)Building all components...$(NC)"
	@$(MAKE) build-frontend
	@$(MAKE) build-backend

build-frontend: ## Build frontend application
	@echo "$(GREEN)Building frontend...$(NC)"
	@npm run build

build-backend: ## Build all backend services
	@echo "$(GREEN)Building backend services...$(NC)"
	@cd backend && make build-all

build-service: ## Build specific service (usage: make build-service SERVICE=user-svc)
	@echo "$(GREEN)Building $(SERVICE)...$(NC)"
	@cd backend/$(SERVICE) && make build

## Quality Commands

lint: ## Run linting for all code
	@echo "$(GREEN)Running linting...$(NC)"
	@npm run lint
	@cd backend && make lint

lint-fix: ## Fix linting issues where possible
	@echo "$(GREEN)Fixing linting issues...$(NC)"
	@npm run lint:fix

type-check: ## Run TypeScript type checking
	@echo "$(GREEN)Running type checks...$(NC)"
	@npm run type-check

## Deployment Commands

deploy: ## Deploy to production with migrations
	@echo "$(GREEN)Deploying to production...$(NC)"
	@./scripts/deploy/deploy.sh production

deploy-staging: ## Deploy to staging environment
	@echo "$(GREEN)Deploying to staging...$(NC)"
	@./scripts/deploy/deploy.sh staging

deploy-dry-run: ## Show what would be deployed without executing
	@echo "$(GREEN)Dry run deployment...$(NC)"
	@./scripts/deploy/deploy.sh --dry-run

rollback: ## Rollback deployment (usage: make rollback VERSION=v1.2.3)
	@echo "$(RED)Rolling back deployment...$(NC)"
	@./scripts/deploy/rollback.sh $(VERSION)

migrate: ## Run database migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	@./scripts/deploy/migrations.sh up

migrate-rollback: ## Rollback database migrations (usage: make migrate-rollback STEPS=1)
	@echo "$(RED)Rolling back migrations...$(NC)"
	@./scripts/deploy/migrations.sh down $(STEPS)

## Monitoring Commands

monitor-start: ## Start monitoring stack
	@echo "$(GREEN)Starting monitoring stack...$(NC)"
	@./scripts/monitoring/control.sh start $(PROFILE)

monitor-stop: ## Stop monitoring stack
	@echo "$(YELLOW)Stopping monitoring stack...$(NC)"
	@./scripts/monitoring/control.sh stop

monitor-status: ## Check monitoring status
	@./scripts/monitoring/control.sh status

monitor-logs: ## View monitoring logs
	@./scripts/monitoring/control.sh logs

## Feature Flag Commands

feature-list: ## List all feature flags
	@./scripts/admin/feature-flags.sh list_flags

feature-get: ## Get feature flag details (usage: make feature-get FLAG=my_flag)
	@./scripts/admin/feature-flags.sh get_flag $(FLAG)

feature-toggle: ## Toggle feature flag (usage: make feature-toggle FLAG=my_flag ENV=production)
	@./scripts/admin/feature-flags.sh toggle_flag $(FLAG) $(ENV)

feature-enable: ## Enable feature flag with rollout (usage: make feature-enable FLAG=my_flag ENV=production PERCENT=25)
	@./scripts/admin/feature-flags.sh enable_flag $(FLAG) $(ENV) $(PERCENT) "Makefile deployment"

feature-history: ## View feature flag history (usage: make feature-history FLAG=my_flag)
	@./scripts/admin/feature-flags.sh flag_history $(FLAG) 10

## Administrative Commands

admin-secrets: ## Generate secrets for services
	@echo "$(GREEN)Generating service secrets...$(NC)"
	@./scripts/admin/secrets.sh generate

admin-service-accounts: ## Setup service accounts
	@echo "$(GREEN)Setting up service accounts...$(NC)"
	@./scripts/admin/service-accounts.sh setup

## Database Commands

db-backup: ## Backup all databases
	@echo "$(GREEN)Backing up databases...$(NC)"
	@./scripts/admin/backup.sh

db-restore: ## Restore databases from backup (usage: make db-restore BACKUP_FILE=backup.sql)
	@echo "$(GREEN)Restoring databases...$(NC)"
	@./scripts/admin/restore.sh $(BACKUP_FILE)

## Service-Specific Commands

service-logs: ## View logs for specific service (usage: make service-logs SERVICE=user-svc)
	@docker-compose -f backend/docker-compose.yml logs -f $(SERVICE)

service-shell: ## Access shell in service container (usage: make service-shell SERVICE=user-svc)
	@docker-compose -f backend/docker-compose.yml exec $(SERVICE) /bin/sh

service-restart: ## Restart specific service (usage: make service-restart SERVICE=user-svc)
	@docker-compose -f backend/docker-compose.yml restart $(SERVICE)

## Maintenance Commands

clean: ## Clean build artifacts and temporary files
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	@rm -rf frontend/dist frontend/node_modules/.cache
	@cd backend && make clean
	@docker system prune -f

clean-all: ## Clean everything including Docker volumes and images
	@echo "$(RED)Deep cleaning all artifacts...$(NC)"
	@$(MAKE) clean
	@docker-compose -f backend/docker-compose.yml down -v --rmi local
	@docker system prune -a -f

cache-clean: ## Clean Docker build caches
	@echo "$(YELLOW)Cleaning Docker build caches...$(NC)"
	@make -f Makefile.cache cache-clean

## Validation Commands

validate: ## Run all validation checks
	@echo "$(GREEN)Running validation checks...$(NC)"
	@./scripts/hooks/helm-lint.sh
	@./scripts/hooks/terraform-validate.sh
	@./scripts/hooks/validate-k8s-manifests.sh

validate-security: ## Run security validation
	@echo "$(GREEN)Running security validation...$(NC)"
	@./scripts/test/security.sh --validate-only

# Allow passing of arguments to make targets
%:
	@: