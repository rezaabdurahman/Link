# Environment Variables Setup Guide

## Overview

Your Link distributed architecture now uses a secure, layered environment variable system that separates concerns and ensures no secrets are hardcoded in the repository.

## Architecture

### 1. **Environment Variable Layers**

```
┌─────────────────────┐
│   GitHub Secrets    │ ← Production/CI values
│                     │
├─────────────────────┤
│   .env files        │ ← Local development defaults
│                     │
├─────────────────────┤
│  docker-compose.yml │ ← Service configuration
│                     │
└─────────────────────┘
```

### 2. **File Structure**

```
Link-distributed-architecture/
├── .env/
│   ├── .env.pgbouncer          # PgBouncer connection pooling config
│   └── .env.production.example # Production template (safe to commit)
├── backend/
│   ├── api-gateway/.env.development    # API Gateway dev config
│   ├── ai-svc/.env.development        # AI Service dev config
│   └── [other-services]/.env.development
├── docker-compose.yml         # Service orchestration with env vars
└── .github/workflows/ci.yml   # CI/CD with GitHub Secrets
```

## Environment Variable Usage Patterns

### 1. **Docker Compose Pattern**
```yaml
environment:
  - DB_PASSWORD=${POSTGRES_PASSWORD}           # Required from environment
  - REDIS_PASSWORD=${REDIS_PASSWORD:-}         # Optional (empty default)
  - JWT_SECRET=${JWT_SECRET:-dev-fallback}     # Required with dev fallback
```

### 2. **Service .env Files Pattern**
```bash
# backend/api-gateway/.env.development
JWT_SECRET=${JWT_SECRET:-development-secret-key-change-in-production}
DB_PASSWORD=${DB_PASSWORD:-your_password}
```

### 3. **GitHub Actions Pattern**
```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY || 'test-key-for-ci' }}
  JWT_SECRET: ${{ secrets.JWT_SECRET || 'test-jwt-secret-for-ci-only' }}
```

## Secret Categories

### 🔐 **Authentication Secrets**
- `JWT_SECRET` - Used by api-gateway and ai-svc for token validation
- `SERVICE_AUTH_TOKEN` - Inter-service authentication

### 🗄️ **Database Secrets**
- `POSTGRES_PASSWORD` - Main PostgreSQL password
- `USER_SERVICE_DB_PASSWORD` - User service database
- `CHAT_SERVICE_DB_PASSWORD` - Chat service database
- `AI_SERVICE_DB_PASSWORD` - AI service database
- `DISCOVERY_SERVICE_DB_PASSWORD` - Discovery service database
- `SEARCH_SERVICE_DB_PASSWORD` - Search service database
- `LOCATION_SERVICE_DB_PASSWORD` - Location service database
- `STORIES_SERVICE_DB_PASSWORD` - Stories service database
- `OPPORTUNITIES_SERVICE_DB_PASSWORD` - Opportunities service database

### 🔄 **Cache & Queue Secrets**
- `REDIS_PASSWORD` - Redis cache password

### 📊 **Monitoring Secrets**
- `GRAFANA_ADMIN_PASSWORD` - Grafana dashboard admin
- `PGBOUNCER_ADMIN_PASSWORD` - PgBouncer admin interface
- `PGBOUNCER_STATS_PASSWORD` - PgBouncer statistics

### 🤖 **Third-Party API Secrets**
- `OPENAI_API_KEY` - OpenAI API access

## How It Works

### Local Development
1. **Default behavior**: Services use safe development defaults
   ```bash
   JWT_SECRET=${JWT_SECRET:-development-secret-key-change-in-production}
   ```
   If `JWT_SECRET` is not set, it uses the fallback value.

2. **Override with real secrets**: Set environment variables to override defaults
   ```bash
   export JWT_SECRET="your-real-secret"
   docker-compose up
   ```

### Production/CI
1. **GitHub Secrets**: Real production values stored securely in GitHub
2. **CI/CD**: Workflows inject secrets as environment variables
   ```yaml
   env:
     JWT_SECRET: ${{ secrets.JWT_SECRET }}
   ```
3. **Terraform**: Can reference GitHub Secrets for infrastructure deployment

## Current Status

### ✅ **Completed**
- All hardcoded secrets removed from code
- Environment variable patterns implemented
- Safe development defaults provided
- GitHub Actions configured to use secrets
- Secret scanning enabled in CI

### ⏳ **Manual Step Required**
- Add secrets from `secrets.txt` to GitHub repository settings
- URL: `https://github.com/rezaabdurahman/Link/settings/secrets/actions`

## Security Features

### 🛡️ **Prevention**
- **Pre-commit hooks**: git-secrets prevents committing secrets
- **CI scanning**: Gitleaks scans every PR for secrets
- **Pattern detection**: Custom regex patterns catch common secret formats

### 🔍 **Detection**
- **Automated tools**: TruffleHog, Gitleaks, detect-secrets
- **Git history**: Clean - no secrets found in commit history
- **Regular scans**: Weekly secret scanning planned

### 🔒 **Isolation**
- **Environment separation**: Development vs production secrets
- **Service isolation**: Each service can have its own database credentials
- **Fallback safety**: Development defaults prevent crashes

## Usage Examples

### Starting Services Locally
```bash
# With development defaults
docker-compose up

# With production-like secrets
export JWT_SECRET="your-production-jwt-secret"
export POSTGRES_PASSWORD="your-production-db-password"
docker-compose up
```

### Running Tests
```bash
# Tests use safe defaults automatically
npm test

# Override for specific testing
JWT_SECRET="test-specific-secret" npm test
```

This setup ensures:
- ✅ No secrets in version control
- ✅ Easy local development
- ✅ Secure production deployment
- ✅ Proper environment parity
- ✅ Automated security scanning
