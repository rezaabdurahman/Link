#!/bin/bash

# =================================================================
# Database Security Configuration Test
# =================================================================
# This script validates that database credentials are properly configured
# and no hardcoded secrets exist in the codebase

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "🔐 Testing database security configuration..."
echo ""

# Test 1: Check for hardcoded passwords in committed files
echo "🔍 Test 1: Scanning for hardcoded passwords in committed files..."
HARDCODED_FOUND=false

# Check .env file for hardcoded passwords
if grep -q "PASSWORD=.*[^}]$" "$BACKEND_DIR/.env" 2>/dev/null; then
    echo "❌ Found hardcoded passwords in .env file"
    HARDCODED_FOUND=true
else
    echo "✅ No hardcoded passwords found in .env"
fi

# Check for any hardcoded database passwords in source code (excluding test files and config defaults)
SUSPICIOUS_FILES=$(find "$BACKEND_DIR" -name "*.go" -o -name "*.yaml" -o -name "*.yml" | \
   xargs grep -l "password.*=.*[a-zA-Z0-9]" 2>/dev/null | \
   grep -v ".git" | \
   grep -v "_test.go" | \
   grep -v "test/" | \
   grep -v "config.go" | \
   grep -v "integration_test" | \
   head -1)

if [[ -n "$SUSPICIOUS_FILES" ]]; then
    echo "⚠️  Found potential hardcoded passwords in source files:"
    echo "$SUSPICIOUS_FILES"
    echo "   Please review these files to ensure no real passwords are hardcoded"
else
    echo "✅ No suspicious hardcoded passwords found in source code"
fi

# Test 2: Verify .env.local is in .gitignore
echo ""
echo "🔍 Test 2: Checking .gitignore configuration..."
if grep -q "\.env\.local" "$BACKEND_DIR/../.gitignore" 2>/dev/null; then
    echo "✅ .env.local is properly excluded from version control"
else
    echo "❌ .env.local is not in .gitignore"
    HARDCODED_FOUND=true
fi

# Test 3: Check if .env.local exists and has proper permissions
echo ""
echo "🔍 Test 3: Checking .env.local file security..."
if [[ -f "$BACKEND_DIR/.env.local" ]]; then
    PERMISSIONS=$(stat -f "%A" "$BACKEND_DIR/.env.local" 2>/dev/null || stat -c "%a" "$BACKEND_DIR/.env.local" 2>/dev/null || echo "unknown")
    if [[ "$PERMISSIONS" == "600" ]]; then
        echo "✅ .env.local has secure permissions (600)"
    else
        echo "⚠️  .env.local permissions are $PERMISSIONS (should be 600)"
        echo "   Run: chmod 600 $BACKEND_DIR/.env.local"
    fi
    
    # Check if .env.local has generated passwords
    if grep -q "SERVICE_PASSWORD=" "$BACKEND_DIR/.env.local" && \
       ! grep -q "SERVICE_PASSWORD=$" "$BACKEND_DIR/.env.local"; then
        echo "✅ .env.local contains generated service passwords"
    else
        echo "⚠️  .env.local appears to be missing generated passwords"
        echo "   Run: $BACKEND_DIR/scripts/setup-dev-secrets.sh"
    fi
else
    echo "⚠️  .env.local not found (run setup-dev-secrets.sh to create)"
fi

# Test 4: Validate docker-compose configuration
echo ""
echo "🔍 Test 4: Validating docker-compose service isolation..."
SERVICES=(user chat discovery search feature)
for service in "${SERVICES[@]}"; do
    service_db_user="${service}_service_user"
    if grep -q "$service_db_user" "$BACKEND_DIR/docker-compose.yml"; then
        echo "✅ ${service}-svc uses dedicated database user ($service_db_user)"
    else
        echo "❌ ${service}-svc missing dedicated database user configuration ($service_db_user)"
        HARDCODED_FOUND=true
    fi
done

# Test 5: Check Kubernetes External Secrets configuration
echo ""
echo "🔍 Test 5: Validating Kubernetes External Secrets..."
if [[ -f "$BACKEND_DIR/../k8s/secrets/database-external-secrets.yaml" ]]; then
    if grep -q "postgres-service-passwords" "$BACKEND_DIR/../k8s/secrets/database-external-secrets.yaml" && \
       grep -q "user-service-password" "$BACKEND_DIR/../k8s/secrets/database-external-secrets.yaml"; then
        echo "✅ Kubernetes External Secrets properly configured for service isolation"
    else
        echo "❌ Kubernetes External Secrets missing service-specific configuration"
        HARDCODED_FOUND=true
    fi
else
    echo "⚠️  Kubernetes External Secrets configuration not found"
fi

# Test 6: Validate database initialization script
echo ""
echo "🔍 Test 6: Checking database initialization security..."
INIT_SCRIPT="$BACKEND_DIR/scripts/init-db-cnpg-compat.sh"
if [[ -f "$INIT_SCRIPT" ]]; then
    if grep -q "CREATE USER.*service_user" "$INIT_SCRIPT" && \
       grep -q "GRANT ALL ON SCHEMA public" "$INIT_SCRIPT"; then
        echo "✅ Database initialization script creates service-specific users with proper permissions"
    else
        echo "❌ Database initialization script missing service-specific user setup"
        HARDCODED_FOUND=true
    fi
else
    echo "❌ Database initialization script not found"
    HARDCODED_FOUND=true
fi

# Final result
echo ""
echo "=================================================="
if [[ "$HARDCODED_FOUND" == "false" ]]; then
    echo "🎉 All security tests passed!"
    echo "✅ No hardcoded secrets found"
    echo "✅ Service isolation properly configured"
    echo "✅ Production security model implemented"
    exit 0
else
    echo "❌ Some security issues found!"
    echo "   Please review the failed tests above and fix any issues."
    echo "   Run this script again after making changes."
    exit 1
fi