#!/bin/bash
# Comprehensive Terraform validation hook
set -e

echo "🏗️ Running comprehensive Terraform validation..."

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed"
    echo "💡 Install Terraform: https://learn.hashicorp.com/tutorials/terraform/install-cli"
    exit 1
fi

# Check if we're in a git repository and terraform directory exists
if [ ! -d "terraform/" ]; then
    echo "📝 No terraform/ directory found, skipping validation"
    exit 0
fi

cd terraform/

violations=0

echo "🎨 Checking Terraform formatting..."
if terraform fmt -check -recursive -diff; then
    echo "✅ All Terraform files are properly formatted"
else
    echo "❌ Terraform formatting issues found"
    echo "💡 Run 'terraform fmt -recursive' to fix formatting"
    violations=$((violations + 1))
fi

echo "🔄 Initializing Terraform (local backend)..."
if terraform init -backend=false; then
    echo "✅ Terraform initialization successful"
else
    echo "❌ Terraform initialization failed"
    violations=$((violations + 1))
fi

echo "✅ Validating Terraform configuration..."
if terraform validate; then
    echo "✅ Terraform configuration is valid"
else
    echo "❌ Terraform validation failed"
    violations=$((violations + 1))
fi

# Install and run tflint if available
if command -v tflint &> /dev/null; then
    echo "🔍 Running TFLint analysis..."
    if tflint --init && tflint --format compact --recursive; then
        echo "✅ TFLint analysis passed"
    else
        echo "⚠️ TFLint found issues (warnings only)"
    fi
else
    echo "⚠️ TFLint not found, skipping advanced linting"
    echo "💡 Install TFLint: https://github.com/terraform-linters/tflint"
fi

# Run Checkov security scan if available
if command -v checkov &> /dev/null; then
    echo "🔒 Running Terraform security scan..."
    if checkov -d . --framework terraform --quiet; then
        echo "✅ Security scan passed"
    else
        echo "⚠️ Security scan found issues (warnings only)"
    fi
else
    echo "⚠️ Checkov not found, skipping security scan"
    echo "💡 Install Checkov: pip install checkov"
fi

# Generate documentation if terraform-docs is available
if command -v terraform-docs &> /dev/null; then
    echo "📚 Generating Terraform documentation..."
    terraform-docs markdown table . > terraform-docs.md
    echo "✅ Documentation generated: terraform-docs.md"
else
    echo "⚠️ terraform-docs not found, skipping documentation generation"
    echo "💡 Install terraform-docs: https://github.com/terraform-docs/terraform-docs"
fi

# Create basic tfvars for development if it doesn't exist
if [ ! -f "terraform.tfvars" ] && [ ! -f "terraform.tfvars.example" ]; then
    echo "📝 Creating example terraform.tfvars..."
    cat > terraform.tfvars.example << EOF
# Example Terraform variables
# Copy this file to terraform.tfvars and customize for your environment

postgres_host = "localhost"
postgres_password = "your_secure_password"
postgres_user = "your_user"
environment = "development"

# Development settings
database_connection_limit = 20
user_connection_limit = 10
create_monitoring_user = false
enable_pgbouncer = false
enable_ssl = false
backup_retention_days = 7

# Kubernetes settings
kubernetes_namespace = "development"
kubeconfig_path = "~/.kube/config"
kubernetes_context = "development-cluster"
EOF
    echo "✅ Created terraform.tfvars.example"
fi

cd ..

if [ $violations -gt 0 ]; then
    echo "❌ Terraform validation failed with $violations critical violations"
    echo "💡 Fix the issues above before committing"
    exit 1
else
    echo "✅ All Terraform validations passed!"
fi