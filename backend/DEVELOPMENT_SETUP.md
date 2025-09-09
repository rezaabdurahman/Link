# Secure Development Environment Setup

This document describes how to set up a secure local development environment with proper secret management.

## 🔐 Security First Approach

Our development environment follows security best practices:

- **No hardcoded secrets** in committed files
- **Service-specific database isolation** with unique credentials per service
- **Automatically generated strong passwords** using OpenSSL
- **Environment file layering** with `.env.local` taking precedence

## 🚀 Quick Setup

### 1. Generate Development Secrets

Run the setup script to generate secure secrets for local development:

```bash
./scripts/setup-dev-secrets.sh
```

This creates a `.env.local` file with:
- Strong randomly generated passwords for all database services
- JWT secrets and encryption keys
- Service authentication tokens
- Development-specific configuration

### 2. Start Development Environment

```bash
docker-compose up -d
```

The Docker Compose setup automatically loads secrets from `.env.local`.

### 3. Verify Services

Check that all services are running with their dedicated databases:

```bash
docker-compose ps
docker-compose logs user-svc | grep "Database connection successful"
```

## 📁 File Structure

```
backend/
├── .env                    # Base configuration (no secrets)
├── .env.local              # Generated secrets (not committed)
├── scripts/
│   └── setup-dev-secrets.sh # Secret generation script
└── DEVELOPMENT_SETUP.md    # This file
```

## 🗄️ Database Architecture

Each service has its own isolated database:

| Service | Database User | Database Name |
|---------|---------------|---------------|
| user-svc | `user_service_user` | `user_service_db` |
| chat-svc | `chat_service_user` | `chat_service_db` |
| discovery-svc | `discovery_service_user` | `discovery_service_db` |
| search-svc | `search_service_user` | `search_service_db` |
| ai-svc | `ai_service_user` | `ai_service_db` |
| feature-svc | `feature_service_user` | `feature_service_db` |

## 🔒 Security Features

### Automatic Secret Generation
- Uses `openssl rand -base64` for cryptographically secure random passwords
- All secrets are unique and have appropriate length (24+ characters)
- No default or weak passwords

### File Permissions
- `.env.local` has 600 permissions (owner read/write only)
- Never committed to version control (included in `.gitignore`)

### Service Isolation
- Each service connects only to its dedicated database
- No shared database credentials between services
- Proper PostgreSQL SCRAM-SHA-256 authentication

## 🔄 Regenerating Secrets

If secrets are compromised or you need fresh ones:

```bash
./scripts/setup-dev-secrets.sh
```

The script will ask for confirmation before overwriting existing secrets.

## 🚫 What NOT to Do

- ❌ Don't commit `.env.local` to version control
- ❌ Don't use weak or default passwords
- ❌ Don't share secrets via chat/email
- ❌ Don't hardcode secrets in source code
- ❌ Don't reuse the same password across services

## 🎯 Production Notes

- Production uses Kubernetes External Secrets with AWS Secrets Manager
- This local setup mimics the production security model
- All configuration is environment-agnostic and scalable

## 🆘 Troubleshooting

### Permission Denied Errors
```bash
chmod +x ./scripts/setup-dev-secrets.sh
```

### Services Can't Connect to Database
1. Check if `.env.local` exists and has generated passwords
2. Restart Docker Compose: `docker-compose down && docker-compose up -d`
3. Check logs: `docker-compose logs postgres`

### Missing Environment Variables
Ensure you've run `./scripts/setup-dev-secrets.sh` before starting services.