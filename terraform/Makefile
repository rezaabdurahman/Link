# Terraform Environment Management Makefile
# Provides consistent commands across environments

.PHONY: help init plan apply destroy clean validate format lint security

# Default environment
ENV ?= development

# Colors for output
RED    := \033[31m
GREEN  := \033[32m
YELLOW := \033[33m
BLUE   := \033[34m
RESET  := \033[0m

help: ## Show this help message
	@echo "$(BLUE)Terraform Management Commands$(RESET)"
	@echo ""
	@echo "$(YELLOW)Environment Commands:$(RESET)"
	@echo "  make init ENV=development     - Initialize Terraform for development"
	@echo "  make plan ENV=staging         - Plan changes for staging"
	@echo "  make apply ENV=production     - Apply changes for production"
	@echo ""
	@echo "$(YELLOW)Quality Commands:$(RESET)"
	@echo "  make validate                 - Validate Terraform configuration"
	@echo "  make format                   - Format Terraform files"
	@echo "  make lint                     - Run tflint for best practices"
	@echo "  make security                 - Run security checks"
	@echo ""
	@echo "$(YELLOW)Utility Commands:$(RESET)"
	@echo "  make clean                    - Clean temporary files"
	@echo "  make destroy ENV=development  - Destroy infrastructure (DANGEROUS)"
	@echo ""
	@echo "$(GREEN)Current environment: $(ENV)$(RESET)"

validate: ## Validate Terraform configuration
	@echo "$(BLUE)Validating Terraform configuration...$(RESET)"
	terraform validate
	@echo "$(GREEN)✓ Validation passed$(RESET)"

format: ## Format Terraform files
	@echo "$(BLUE)Formatting Terraform files...$(RESET)"
	terraform fmt -recursive
	@echo "$(GREEN)✓ Files formatted$(RESET)"

init: ## Initialize Terraform with environment-specific backend
	@echo "$(BLUE)Initializing Terraform for $(ENV) environment...$(RESET)"
	@if [ ! -f "environments/$(ENV)/terraform.tfvars" ]; then \
		echo "$(RED)Error: environments/$(ENV)/terraform.tfvars not found$(RESET)"; \
		exit 1; \
	fi
	@if [ ! -f "environments/$(ENV)/backend.tf" ]; then \
		echo "$(RED)Error: environments/$(ENV)/backend.tf not found$(RESET)"; \
		exit 1; \
	fi
	cp environments/$(ENV)/backend.tf ./backend.tf
	terraform init -reconfigure
	@echo "$(GREEN)✓ Terraform initialized for $(ENV)$(RESET)"

plan: init ## Plan Terraform changes for specified environment
	@echo "$(BLUE)Planning Terraform changes for $(ENV) environment...$(RESET)"
	terraform plan -var-file="environments/$(ENV)/terraform.tfvars" -out="$(ENV).tfplan"
	@echo "$(GREEN)✓ Plan saved as $(ENV).tfplan$(RESET)"

apply: ## Apply Terraform changes for specified environment
	@echo "$(BLUE)Applying Terraform changes for $(ENV) environment...$(RESET)"
	@if [ ! -f "$(ENV).tfplan" ]; then \
		echo "$(RED)Error: $(ENV).tfplan not found. Run 'make plan ENV=$(ENV)' first$(RESET)"; \
		exit 1; \
	fi
	terraform apply "$(ENV).tfplan"
	rm -f "$(ENV).tfplan"
	@echo "$(GREEN)✓ Changes applied successfully$(RESET)"

destroy: ## DANGEROUS: Destroy infrastructure for specified environment
	@echo "$(RED)WARNING: This will destroy all infrastructure for $(ENV) environment!$(RESET)"
	@echo "$(YELLOW)Are you sure? This action cannot be undone!$(RESET)"
	@read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ]
	terraform destroy -var-file="environments/$(ENV)/terraform.tfvars"

clean: ## Clean temporary files
	@echo "$(BLUE)Cleaning temporary files...$(RESET)"
	rm -f *.tfplan
	rm -f backend.tf
	rm -rf .terraform/
	@echo "$(GREEN)✓ Temporary files cleaned$(RESET)"

lint: ## Run tflint for best practices
	@echo "$(BLUE)Running tflint...$(RESET)"
	@if command -v tflint >/dev/null 2>&1; then \
		tflint; \
		echo "$(GREEN)✓ Linting completed$(RESET)"; \
	else \
		echo "$(YELLOW)Warning: tflint not installed. Install with: brew install tflint$(RESET)"; \
	fi

security: ## Run security checks
	@echo "$(BLUE)Running security checks...$(RESET)"
	@if command -v tfsec >/dev/null 2>&1; then \
		tfsec .; \
		echo "$(GREEN)✓ Security scan completed$(RESET)"; \
	else \
		echo "$(YELLOW)Warning: tfsec not installed. Install with: brew install tfsec$(RESET)"; \
	fi

# Development shortcuts
dev-init: ## Quick init for development
	@make init ENV=development

dev-plan: ## Quick plan for development  
	@make plan ENV=development

dev-apply: ## Quick apply for development
	@make apply ENV=development

# Production safety checks
prod-plan: ## Plan for production with extra validation
	@echo "$(YELLOW)Planning for PRODUCTION environment...$(RESET)"
	@make validate
	@make format
	@make plan ENV=production

prod-apply: ## Apply for production with confirmation
	@echo "$(RED)PRODUCTION DEPLOYMENT$(RESET)"
	@echo "$(YELLOW)Are you sure you want to deploy to production?$(RESET)"
	@read -p "Type 'PRODUCTION' to confirm: " confirm && [ "$$confirm" = "PRODUCTION" ]
	@make apply ENV=production
