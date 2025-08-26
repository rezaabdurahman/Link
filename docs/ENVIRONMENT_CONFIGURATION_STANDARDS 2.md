# Environment Configuration Standards

## Overview

This document defines the standardized environment configuration approach for the Link project, covering frontend, backend services, Docker, and CI/CD environments.

## Standard Environments

### 1. Development (`development`)
- **Purpose**: Individual developer workstation and local development
- **Frontend**: Mocking enabled, auto-login, demo data seeded
- **Backend**: Local database, debug logging, development features enabled
- **Usage**: `npm run dev`, `make dev`

### 2. Test (`test`)
- **Purpose**: Automated testing (unit, integration, CI/CD)
- **Frontend**: Mocking enabled, no authentication required
- **Backend**: In-memory/test databases, minimal logging
- **Usage**: `npm run test`, `make test`

### 3. Staging (`staging`)
- **Purpose**: Pre-production testing and validation
- **Frontend**: Real APIs, authentication required, no mocking
- **Backend**: Production-like infrastructure, structured logging
- **Usage**: CI/CD deployment, manual testing

### 4. Production (`production`)
- **Purpose**: Live production environment
- **Frontend**: Real APIs, all production features enabled
- **Backend**: Production infrastructure, security hardened
- **Usage**: Production deployment only

### 5. Demo (`demo`)
- **Purpose**: Public demonstrations and showcases
- **Frontend**: Mocking enabled, demo banner, seeded data
- **Backend**: Mock services or sandboxed environment
- **Usage**: `npm run build:demo`, demo deployments

## Environment Variable Standards

### Naming Conventions

#### Primary Environment Identifier
- **Frontend**: `VITE_APP_MODE` (development|test|staging|production|demo)
- **Backend**: `APP_ENV` (development|test|staging|production|demo)
- **Build/CI**: `NODE_ENV` (development|production|test) - for build optimization only

#### Authentication Configuration
```bash
# JWT Configuration
JWT_SECRET=<environment-specific-secret>
JWT_EXPIRATION=<token-lifetime>
JWT_ISSUER=link-<service>-<environment>

# Frontend Auth
VITE_REQUIRE_AUTH=<true|false>
VITE_AUTO_LOGIN=<true|false>
VITE_MOCK_USER=<true|false>
```

#### Database Configuration
```bash
# Standard database variables
DB_HOST=<hostname>
DB_PORT=<port>
DB_USER=<username>
DB_PASSWORD=<password>
DB_NAME=<database-name>
DB_SSL_MODE=<disable|require>

# Connection pool settings
DB_MAX_CONNECTIONS=<number>
DB_IDLE_TIMEOUT=<duration>
```

#### API Configuration
```bash
# Frontend API settings
VITE_API_BASE_URL=<api-gateway-url>

# Backend service URLs
USER_SVC_URL=<user-service-url>
CHAT_SVC_URL=<chat-service-url>
AI_SVC_URL=<ai-service-url>
DISCOVERY_SVC_URL=<discovery-service-url>
SEARCH_SVC_URL=<search-service-url>
FEATURE_SVC_URL=<feature-service-url>
```

#### Logging Configuration
```bash
# Backend logging
LOG_LEVEL=<debug|info|warn|error>
LOG_FORMAT=<text|json>

# Frontend error tracking
VITE_SENTRY_DSN=<sentry-dsn>
VITE_SENTRY_ENVIRONMENT=<environment>
```

#### Feature Flags
```bash
# Frontend feature toggles
VITE_ENABLE_MOCKING=<true|false>
VITE_SHOW_DEMO_BANNER=<true|false>
VITE_SEED_DEMO_DATA=<true|false>

# Backend feature toggles
ENABLE_DEBUG_ENDPOINTS=<true|false>
ENABLE_PPROF=<true|false>
```

## Environment-Specific Configurations

### Development Environment
```bash
# Frontend (.env.development)
VITE_APP_MODE=development
VITE_REQUIRE_AUTH=false
VITE_AUTO_LOGIN=true
VITE_MOCK_USER=true
VITE_ENABLE_MOCKING=true
VITE_SHOW_DEMO_BANNER=true
VITE_SEED_DEMO_DATA=true
VITE_API_BASE_URL=http://localhost:8080

# Backend (.env.local for individual workstation)
APP_ENV=development
LOG_LEVEL=debug
LOG_FORMAT=text
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_PPROF=true
DB_SSL_MODE=disable
```

### Test Environment
```bash
# Frontend (.env.test)
VITE_APP_MODE=test
VITE_REQUIRE_AUTH=false
VITE_AUTO_LOGIN=false
VITE_MOCK_USER=true
VITE_ENABLE_MOCKING=true
VITE_SHOW_DEMO_BANNER=false
VITE_SEED_DEMO_DATA=false
VITE_API_BASE_URL=http://localhost:8080

# Backend (.env.test)
APP_ENV=test
LOG_LEVEL=warn
LOG_FORMAT=text
ENABLE_DEBUG_ENDPOINTS=false
ENABLE_PPROF=false
DB_SSL_MODE=disable
```

### Staging Environment
```bash
# Frontend (.env.staging)
VITE_APP_MODE=staging
VITE_REQUIRE_AUTH=true
VITE_AUTO_LOGIN=false
VITE_MOCK_USER=false
VITE_ENABLE_MOCKING=false
VITE_SHOW_DEMO_BANNER=true
VITE_SEED_DEMO_DATA=false
VITE_API_BASE_URL=https://staging-api.link-app.com

# Backend (.env.staging)
APP_ENV=staging
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_DEBUG_ENDPOINTS=false
ENABLE_PPROF=false
DB_SSL_MODE=require
```

### Production Environment
```bash
# Frontend (.env.production)
VITE_APP_MODE=production
VITE_REQUIRE_AUTH=true
VITE_AUTO_LOGIN=false
VITE_MOCK_USER=false
VITE_ENABLE_MOCKING=false
VITE_SHOW_DEMO_BANNER=false
VITE_SEED_DEMO_DATA=false
VITE_API_BASE_URL=https://api.link-app.com

# Backend (.env.production)
APP_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_DEBUG_ENDPOINTS=false
ENABLE_PPROF=false
DB_SSL_MODE=require
```

### Demo Environment
```bash
# Frontend (.env.demo)
VITE_APP_MODE=demo
VITE_REQUIRE_AUTH=false
VITE_AUTO_LOGIN=true
VITE_MOCK_USER=true
VITE_ENABLE_MOCKING=true
VITE_SHOW_DEMO_BANNER=true
VITE_DEMO_BANNER_TEXT=🚀 Demo Mode - This is a preview version for feedback
VITE_SEED_DEMO_DATA=true
VITE_API_BASE_URL=https://demo-api-placeholder.com

# Backend (.env.demo)
APP_ENV=demo
LOG_LEVEL=info
LOG_FORMAT=text
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_PPROF=false
DB_SSL_MODE=disable
```

## File Structure Standards

### Frontend Environment Files
```
frontend/
├── .env.template        # Template with all variables documented
├── .env.example         # Simple example file
├── .env.development     # Development environment
├── .env.local          # Local overrides (gitignored)
├── .env.test           # Test environment
├── .env.staging        # Staging environment
├── .env.production     # Production environment
└── .env.demo           # Demo environment
```

### Backend Service Environment Files
```
backend/[service]/
├── .env.example          # Template with all variables documented
├── .env.local           # Local development (gitignored)
├── .env.test            # Test environment
├── .env.development     # Docker compose development
├── .env.staging         # Staging environment
└── .env.production      # Production environment
```

### Shared Backend Environment Files
```
backend/
├── .env                 # Shared development configuration
├── .env.staging         # Shared staging configuration
└── .env.production      # Shared production configuration
```

## Build Script Standards

### Frontend Package.json Scripts
```json
{
  "scripts": {
    "dev": "vite --mode development",
    "dev:local": "vite --mode development",
    "dev:staging": "vite --mode staging",
    "test": "jest",
    "build": "vite build --mode production",
    "build:development": "vite build --mode development",
    "build:test": "vite build --mode test", 
    "build:staging": "vite build --mode staging",
    "build:production": "vite build --mode production",
    "build:demo": "vite build --mode demo"
  }
}
```

### Backend Makefile Standards
```makefile
.PHONY: dev test build run

# Environment-specific targets
dev:
	APP_ENV=development go run main.go

test:
	APP_ENV=test go test ./...

build:
	CGO_ENABLED=0 GOOS=linux go build -o bin/service main.go

run-staging:
	APP_ENV=staging ./bin/service

run-production:
	APP_ENV=production ./bin/service
```

## Docker Configuration Standards

### Dockerfile Environment Handling
```dockerfile
# Build stage
FROM node:18-alpine AS build
ARG NODE_ENV=production
ARG VITE_APP_MODE=production
ENV NODE_ENV=${NODE_ENV}
ENV VITE_APP_MODE=${VITE_APP_MODE}

# Runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

### Docker Compose Environment Files
- `docker-compose.yml` - Local development
- `docker-compose.staging.yml` - Staging deployment
- `docker-compose.production.yml` - Production deployment

## CI/CD Configuration Standards

### GitHub Actions Environment Matrix
```yaml
strategy:
  matrix:
    environment: [test, staging, production]
    include:
      - environment: test
        node_env: test
        app_mode: test
      - environment: staging
        node_env: production
        app_mode: staging
      - environment: production
        node_env: production
        app_mode: production
```

## Security Standards

### Secret Management
- **Local/Test**: Plain text in .env files (development only)
- **Staging/Production**: Use Kubernetes secrets, AWS Secrets Manager, or external secret management
- **Never commit**: Production secrets, API keys, passwords to git

### Environment File Security
- Add `.env.local` to `.gitignore`
- Use `.env.example` as template with placeholder values
- Document all required environment variables
- Use meaningful defaults where possible

## Migration Guide

### From Current to New Standard

1. **Rename environment identifiers**:
   - Update `VITE_APP_MODE` values to match new standard
   - Ensure `APP_ENV` aligns with `VITE_APP_MODE`
   - Keep `NODE_ENV` for build optimization only

2. **Remove overlapping environments**:
   - Merge `preview` into `staging`
   - Clarify `local` vs `development` usage

3. **Standardize variable names**:
   - Align JWT configuration across services
   - Unify database connection parameters
   - Consistent logging configuration

4. **Update build scripts**:
   - Modify package.json to use new environment names
   - Update Docker build arguments
   - Align CI/CD workflows

## Validation Checklist

- [ ] All services have consistent environment files
- [ ] Build scripts use standardized environment names
- [ ] Docker configurations align with new standards
- [ ] CI/CD pipelines updated with new environment matrix
- [ ] Documentation updated with new standards
- [ ] Team trained on new environment conventions

## References

- [Environment Variables Best Practices](https://12factor.net/config)
- [Docker Environment Variables](https://docs.docker.com/engine/reference/builder/#env)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)