#!/bin/bash

# =================================================================
# Development Environment Secrets Setup
# =================================================================
# This script generates secure secrets for local development
# and creates environment-specific .env files

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_LOCAL_FILE="$BACKEND_DIR/.env.local"

echo "🔐 Setting up secure local development environment..."
echo ""

# Check if .env.local already exists
if [[ -f "$ENV_LOCAL_FILE" ]]; then
    echo "⚠️  Found existing .env.local file."
    read -p "Do you want to regenerate secrets? This will overwrite existing values (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Setup cancelled. Using existing .env.local file."
        exit 0
    fi
    echo "🔄 Regenerating secrets..."
    rm -f "$ENV_LOCAL_FILE"
fi

echo "🔑 Generating secure development secrets..."

# Create .env.local file with generated secrets
cat > "$ENV_LOCAL_FILE" << EOF
# =================================================================
# Local Development Environment Secrets
# Generated on: $(date)
# =================================================================
# DO NOT COMMIT THIS FILE TO VERSION CONTROL

# Main Database Credentials
POSTGRES_PASSWORD=$(openssl rand -base64 24)
REDIS_PASSWORD=$(openssl rand -base64 24)

# Service-specific Database Passwords
USER_SERVICE_PASSWORD=$(openssl rand -base64 24)
CHAT_SERVICE_PASSWORD=$(openssl rand -base64 24)
DISCOVERY_SERVICE_PASSWORD=$(openssl rand -base64 24)
SEARCH_SERVICE_PASSWORD=$(openssl rand -base64 24)
SUMMARYGEN_SERVICE_PASSWORD=$(openssl rand -base64 24)
AI_SERVICE_PASSWORD=$(openssl rand -base64 24)
FEATURE_SERVICE_PASSWORD=$(openssl rand -base64 24)

# Authentication Secrets
JWT_SECRET=$(openssl rand -base64 64)
SERVICE_AUTH_TOKEN=$(openssl rand -base64 32)

# Encryption Keys
DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)
BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)

# Development-specific Configuration
ENVIRONMENT=development
ENABLE_DEBUG_ENDPOINTS=true
LOG_LEVEL=debug

# External Service Placeholders (update as needed)
# OPENAI_API_KEY=sk-proj-your-key-here
# SENTRY_DSN=your-sentry-dsn-here
EOF

# Set appropriate permissions
chmod 600 "$ENV_LOCAL_FILE"

echo "✅ Local development secrets generated successfully!"
echo ""
echo "📁 Created: $ENV_LOCAL_FILE"
echo "🔒 File permissions set to 600 (owner read/write only)"
echo ""
echo "📝 Next steps:"
echo "   1. Add any additional API keys (OpenAI, Sentry, etc.) to .env.local"
echo "   2. Start your development environment: docker-compose up -d"
echo "   3. The .env.local file is automatically loaded by Docker Compose"
echo ""
echo "⚠️  Important:"
echo "   - .env.local is in .gitignore and will not be committed"
echo "   - Never share or commit this file"
echo "   - Regenerate secrets if they are ever compromised"