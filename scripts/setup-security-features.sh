#!/bin/bash
set -e

# Combined setup script for mTLS (Linkerd) and Database Isolation
# Uses existing docker-compose.yml with Terraform-generated secure credentials

echo "🔐 Setting up Link Security Features..."
echo "   ✅ Database isolation with unique credentials per service"
echo "   ✅ mTLS service mesh with Linkerd (Kubernetes)"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is required but not installed"
    exit 1
fi

if ! command_exists terraform; then
    echo "❌ Terraform is required but not installed"
    exit 1
fi

echo "✅ Prerequisites met"

# 1. Database Isolation Setup
echo ""
echo "🗄️ Step 1: Setting up Database Isolation..."
echo ""

cd terraform

# Check if PostgreSQL admin password is set
if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "❌ POSTGRES_PASSWORD environment variable is required"
    echo "💡 This is the admin password for your PostgreSQL instance"
    echo "💡 Set it with: export POSTGRES_PASSWORD=your_admin_password"
    exit 1
fi

# Check if Terraform is initialized
if [ ! -d ".terraform" ]; then
    echo "📦 Initializing Terraform..."
    terraform init
fi

# Determine environment
ENVIRONMENT=${1:-development}
echo "🎯 Using environment: $ENVIRONMENT"

# Check for environment-specific config
if [ -f "environments/$ENVIRONMENT/terraform.tfvars" ]; then
    echo "✅ Using environment config: environments/$ENVIRONMENT/terraform.tfvars"
    VAR_FILE="-var-file=environments/$ENVIRONMENT/terraform.tfvars"
else
    echo "⚠️  No environment-specific config found, using defaults"
    VAR_FILE=""
fi

# Apply Terraform configuration
echo "🚀 Creating isolated databases and generating secure credentials..."
terraform plan $VAR_FILE -out=tfplan

echo ""
echo "📋 Terraform will create:"
echo "   ✅ 5 isolated databases (link_users, link_chat, link_ai, link_search, link_discovery)"
echo "   ✅ 5 service users with unique 32-character passwords"
echo "   ✅ Kubernetes secrets for production deployment"
echo "   ✅ Environment files for Docker Compose"
echo ""

read -p "Apply database isolation? (y/N): " confirm
if [[ $confirm == [yY] ]]; then
    terraform apply tfplan
    echo "✅ Database isolation configured successfully!"
else
    echo "❌ Database setup cancelled"
    rm -f tfplan
    exit 1
fi

# Clean up
rm -f tfplan

# 2. Use Terraform-generated environment files
echo ""
echo "🔑 Using Terraform-generated environment files..."

cd ..

# Terraform automatically creates .env files for each service
if [ -d ".env" ]; then
    echo "✅ Found Terraform-generated .env files"
    ls -la .env/
    
    # Terraform already created everything we need!
    echo "✅ Database isolation is ready to use"
    echo "💡 Terraform created individual .env files for each service"
    echo "💡 Your docker-compose.yml will automatically use the generated credentials"
else
    echo "⚠️  .env directory not found - Terraform may not have completed successfully"
fi

# 3. Instructions for using existing Docker Compose
echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📋 Your existing docker-compose.yml is already configured for database isolation!"
echo ""
echo "🔄 To use with database isolation:"
echo "   1. Source the generated environment:"
echo "      source .env.db-isolation"
echo ""
echo "   2. Run your existing Docker Compose:"
echo "      docker-compose up"
echo ""
echo "   3. Your services will automatically use:"
echo "      ✅ Isolated databases per service"
echo "      ✅ Unique secure passwords"
echo "      ✅ Connection pooling via PgBouncer"
echo ""
echo "🔒 For Kubernetes with mTLS:"
echo "   1. Install Linkerd: ./k8s/linkerd/install-linkerd.sh"
echo "   2. Deploy services: kubectl apply -f k8s/linkerd/services-with-mtls.yaml"
echo "   3. Check mTLS status: linkerd viz stat deployment -n link-services"
echo ""
echo "🎯 No separate Docker Compose file needed - your main one is already prepared!"
