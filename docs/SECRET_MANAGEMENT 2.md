# Secret Management Guide

## 🎯 Overview

This project uses **GitHub Secrets** for both CI/CD and application secrets, following security best practices and avoiding hardcoded credentials.

## 🏗️ Architecture

### **JWT Authentication Flow:**
```
1. user-svc: Issues JWT tokens (needs JWT_SECRET)
2. api-gateway: Validates JWT, forwards user context via headers (needs JWT_SECRET)  
3. Other services: Read user context from headers (no JWT_SECRET needed)
4. chat-svc: Exception - validates JWT for WebSocket connections (needs JWT_SECRET)
```

### **Secret Distribution:**
- **CI/CD**: GitHub Secrets → Environment variables in workflows
- **Development**: Local `.env` files (in `.gitignore`)
- **Production**: GitHub Secrets → Kubernetes secrets via Terraform

## 🚀 Quick Setup

### 1. Generate Secrets
```bash
# Run the secret generation script
./scripts/generate-secrets.sh

# Review generated secrets
cat secrets.txt
```

### 2. Add to GitHub
1. Go to **Repository → Settings → Secrets and variables → Actions**
2. Add each secret from `secrets.txt` with the exact name
3. Delete `secrets.txt` after adding

### 3. Local Development
```bash
# Copy example file and customize
cp .env.production.example .env

# Edit .env with your local values (safe to use weak passwords locally)
# This file is in .gitignore and won't be committed
```

## 📋 Required GitHub Secrets

### **Core Secrets (Required for CI/CD):**
- `JWT_SECRET` - JWT signing key (shared across api-gateway, user-svc, chat-svc)
- `SERVICE_AUTH_TOKEN` - Service-to-service authentication
- `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_NAME` - Database connection
- `REDIS_PASSWORD` - Redis authentication
- `OPENAI_API_KEY` - AI features

### **Monitoring Secrets:**
- `GRAFANA_ADMIN_PASSWORD` - Grafana access
- `PGBOUNCER_ADMIN_PASSWORD` - PgBouncer admin
- `PGBOUNCER_STATS_PASSWORD` - PgBouncer monitoring

### **Future/Optional:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - Terraform S3 backend

## 🔄 Terraform Integration

The Terraform workflow automatically uses GitHub Secrets:

```yaml
# In .github/workflows/terraform.yml
terraform_password = "${{ secrets.POSTGRES_PASSWORD }}"
terraform_host = "${{ secrets.POSTGRES_HOST }}"
```

**Terraform Plan Output Available:**
1. **PR Comments**: Auto-posted with expandable plan
2. **GitHub Artifacts**: Full plan files (30-day retention)
3. **Workflow Logs**: Real-time plan output
4. **CLI Download**: `gh run download --name terraform-plan-{PR-number}`

## 🛡️ Security Features

### **Automated Protection:**
- Gitleaks scanning on all PRs
- Hardcoded pattern detection
- Secret masking in CI logs
- .gitignore includes secret files

### **Manual Best Practices:**
- Rotate secrets quarterly
- Use strong, unique passwords
- Never commit .env files
- Different secrets per environment

## 🐛 Troubleshooting

### **"Authentication required" in CI:**
- Verify GitHub Secrets are added with correct names
- Check workflow has access to secrets
- Ensure fallback values work for CI environment

### **"Invalid JWT token" errors:**
- Ensure JWT_SECRET is identical across api-gateway, user-svc, chat-svc
- Check JWT expiration settings
- Verify environment variable loading

### **Terraform fails with "authentication error":**
- Verify POSTGRES_* secrets are set in GitHub
- Check Terraform has access to production environment
- Ensure manual approval is completed for production

---

**Related Files:**
- `.env.production.example` - All required variables
- `scripts/generate-secrets.sh` - Secret generation
- `.github/workflows/terraform.yml` - Infrastructure automation
- `.gitignore` - Secret file exclusions
