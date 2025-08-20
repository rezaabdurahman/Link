#!/bin/bash
set -e

# Setup script for Terraform database isolation
# Creates isolated databases for each service with unique credentials

echo "🗄️ Setting up Database Isolation with Terraform..."

# Check if we're in the terraform directory
if [ ! -f "main.tf" ]; then
    echo "❌ This script must be run from the terraform directory"
    echo "💡 Run: cd terraform && ../scripts/setup-db-isolation.sh"
    exit 1
fi

# Check if PostgreSQL is running (for local development)
if ! pg_isready -h localhost -p 5432 -U postgres > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL not detected on localhost:5432"
    echo "💡 Make sure PostgreSQL is running or update postgres_host in terraform.tfvars"
    echo "💡 For Docker: docker-compose up postgres"
    echo ""
    read -p "Continue anyway? (y/N): " confirm
    if [[ $confirm != [yY] ]]; then
        exit 1
    fi
fi

# Check if required environment variables are set
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD environment variable is required"
    echo "💡 Set it with: export POSTGRES_PASSWORD=your_password"
    exit 1
fi

# Determine which environment to use
ENVIRONMENT=${1:-development}
echo "🎯 Using environment: $ENVIRONMENT"

# Check if environment-specific config exists
if [ -f "environments/$ENVIRONMENT/terraform.tfvars" ]; then
    echo "✅ Found environment config: environments/$ENVIRONMENT/terraform.tfvars"
    VAR_FILE="environments/$ENVIRONMENT/terraform.tfvars"
else
    echo "⚠️  No environment-specific config found for $ENVIRONMENT"
    echo "💡 Using default variables.tf"
    VAR_FILE=""
fi

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
    echo "📦 Initializing Terraform..."
    terraform init
fi

echo ""
echo "📋 Planning database isolation setup..."
echo "   This will create:"
echo "   ✅ Isolated databases for each service (users, chat, ai, search, discovery)"
echo "   ✅ Dedicated database users with unique 32-character passwords"
echo "   ✅ Proper permissions and connection limits"
echo "   ✅ Kubernetes secrets for database credentials"
echo "   ✅ PgBouncer configuration for connection pooling"
echo ""

# Run terraform plan
if [ -n "$VAR_FILE" ]; then
    terraform plan -var-file="$VAR_FILE" -out=tfplan
else
    terraform plan -out=tfplan
fi

echo ""
echo "📋 Terraform plan created. Review the changes above."
echo ""
read -p "Apply these changes? (y/N): " confirm

if [[ $confirm == [yY] ]]; then
    echo "🚀 Applying Terraform configuration..."
    terraform apply tfplan
    
    echo ""
    echo "🎉 Database isolation setup complete!"
    echo ""
    echo "📋 What was created:"
    echo "   ✅ 5 isolated service databases"
    echo "   ✅ 5 dedicated database users with secure passwords"
    echo "   ✅ Kubernetes secrets with database credentials"
    echo "   ✅ PgBouncer configuration for connection pooling"
    echo ""
    echo "🔐 Security improvements:"
    echo "   ✅ Each service can only access its own database"
    echo "   ✅ Unique 32-character passwords per service"
    echo "   ✅ Connection limits per service"
    echo "   ✅ SSL-enabled database connections"
    echo ""
    echo "📁 Generated files:"
    if [ -d "../.env" ]; then
        echo "   📄 Environment files in ../.env/"
    fi
    if [ -f "scripts/backup-databases.sh" ]; then
        echo "   📄 Backup script: scripts/backup-databases.sh"
    fi
    if [ -f "../docker-compose.db-isolation.yml" ]; then
        echo "   📄 Docker Compose override: ../docker-compose.db-isolation.yml"
    fi
    echo ""
    echo "🔄 Next steps:"
    echo "   1. Update your services to use the new database credentials"
    echo "   2. Deploy services to Kubernetes with the generated secrets"
    echo "   3. Run: kubectl get secrets -n link-services (to see generated secrets)"
    
    # Clean up
    rm -f tfplan
    
else
    echo "❌ Terraform apply cancelled"
    rm -f tfplan
    exit 1
fi
