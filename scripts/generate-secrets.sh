#!/bin/bash

# =================================================================
# GitHub Secrets Generation Script
# =================================================================
# This script generates secure secrets for your Link application
# IMPORTANT: Add the generated values to GitHub Secrets manually!

set -euo pipefail

echo "🔐 Generating secure secrets for Link application..."
echo ""
echo "⚠️  SECURITY NOTICE:"
echo "   - Generated secrets will be saved to 'secrets.txt'"
echo "   - Manually add these to GitHub → Settings → Secrets → Actions"
echo "   - Delete 'secrets.txt' after adding to GitHub"
echo "   - Never commit secrets.txt to version control"
echo ""

# Create secrets file
SECRETS_FILE="secrets.txt"
rm -f "$SECRETS_FILE"

echo "# ==================================================================" >> "$SECRETS_FILE"
echo "# Generated GitHub Secrets for Link Application" >> "$SECRETS_FILE"
echo "# Generated on: $(date)" >> "$SECRETS_FILE"
echo "# ==================================================================" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"

echo "🔑 Generating authentication secrets..."
echo "# 🔑 Authentication Secrets" >> "$SECRETS_FILE"
echo "JWT_SECRET=$(openssl rand -base64 64)" >> "$SECRETS_FILE"
echo "SERVICE_AUTH_TOKEN=$(openssl rand -base64 32)" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"

echo "🔐 Generating encryption secrets..."
echo "# 🔐 Encryption Secrets" >> "$SECRETS_FILE"
echo "DATA_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> "$SECRETS_FILE"
echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -base64 32)" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"

echo "🗄️ Generating database secrets..."
echo "# 🗄️ Database Secrets" >> "$SECRETS_FILE"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"
echo "# Service-specific Database Passwords" >> "$SECRETS_FILE"
echo "USER_SERVICE_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "CHAT_SERVICE_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "DISCOVERY_SERVICE_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "SEARCH_SERVICE_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "AI_SERVICE_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "FEATURE_SERVICE_PASSWORD=$(openssl rand -base64 24)" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"

echo "📊 Generating monitoring secrets..."
echo "# 📊 Monitoring Secrets" >> "$SECRETS_FILE"
echo "GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 16)" >> "$SECRETS_FILE"
echo "PGBOUNCER_ADMIN_PASSWORD=$(openssl rand -base64 16)" >> "$SECRETS_FILE"
echo "PGBOUNCER_STATS_PASSWORD=$(openssl rand -base64 16)" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"

echo "📝 Adding manual configuration secrets..."
echo "# 📝 Manual Configuration (update these values)" >> "$SECRETS_FILE"
echo "POSTGRES_HOST=localhost  # Update with your PostgreSQL host" >> "$SECRETS_FILE"
echo "POSTGRES_USER=link_prod_user  # Update with your PostgreSQL user" >> "$SECRETS_FILE"
echo "DB_NAME=link_prod  # Update with your database name" >> "$SECRETS_FILE"
echo "OPENAI_API_KEY=sk-proj-your-openai-key-here  # Add your OpenAI API key" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"

echo "☁️ Adding cloud provider placeholders..."
echo "# ☁️ Cloud Provider Secrets (for future S3 backend)" >> "$SECRETS_FILE"
echo "AWS_ACCESS_KEY_ID=your-aws-access-key-id" >> "$SECRETS_FILE"
echo "AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key" >> "$SECRETS_FILE"
echo "" >> "$SECRETS_FILE"

echo "📋 Adding GitHub Actions setup instructions..."
cat >> "$SECRETS_FILE" << 'EOF'
# =================================================================
# GitHub Secrets Setup Instructions
# =================================================================
# 
# 1. Go to your GitHub repository
# 2. Click Settings → Secrets and variables → Actions
# 3. Click "New repository secret"
# 4. Add each secret above with the EXACT name (e.g., JWT_SECRET)
# 5. Use the generated value (everything after the = sign)
# 6. Repeat for all secrets
# 
# Required secrets for CI/CD:
# ✅ JWT_SECRET
# ✅ SERVICE_AUTH_TOKEN  
# ✅ DATA_ENCRYPTION_KEY
# ✅ BACKUP_ENCRYPTION_KEY
# ✅ POSTGRES_HOST
# ✅ POSTGRES_USER
# ✅ POSTGRES_PASSWORD
# ✅ DB_NAME
# ✅ REDIS_PASSWORD
# ✅ OPENAI_API_KEY
# ✅ GRAFANA_ADMIN_PASSWORD
# ✅ PGBOUNCER_ADMIN_PASSWORD
# ✅ PGBOUNCER_STATS_PASSWORD
# 
# Optional (for future use):
# ⏳ AWS_ACCESS_KEY_ID
# ⏳ AWS_SECRET_ACCESS_KEY
# 
# =================================================================
EOF

echo "✅ Secrets generated successfully!"
echo ""
echo "📁 Location: $(pwd)/$SECRETS_FILE"
echo ""
echo "🚀 Next steps:"
echo "   1. Review the generated secrets: cat $SECRETS_FILE"
echo "   2. Add them to GitHub → Settings → Secrets → Actions"
echo "   3. Update manual configuration values (POSTGRES_HOST, OPENAI_API_KEY, etc.)"
echo "   4. Delete the secrets file: rm $SECRETS_FILE"
echo ""
echo "🔒 Security reminder:"
echo "   - Never commit $SECRETS_FILE to version control"
echo "   - Use different secrets for development/staging/production"
echo "   - Rotate secrets regularly (quarterly recommended)"
echo ""

# Display the generated secrets for review
echo "📋 Generated secrets preview:"
echo "----------------------------------------"
head -20 "$SECRETS_FILE"
echo "... (see full file for all secrets)"
echo "----------------------------------------"
echo ""
echo "⚠️  Remember to delete $SECRETS_FILE after adding to GitHub!"
