# Environment Variables Guide

This document describes all environment variables used across the Link application for different deployment environments.

## Database Configuration

### PostgreSQL Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | No | `linkuser` | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Production: Yes** | `linkpass` (dev only) | PostgreSQL password |
| `DB_NAME` | No | `linkdb` | Database name |
| `DB_HOST` | No | `link_postgres` | Database host |
| `DB_PORT` | No | `5432` | Database port |
| `DB_SSL_MODE` | No | `disable` (dev), `require` (prod) | SSL connection mode |

**Security Notes:**
- In **production**, `POSTGRES_PASSWORD` MUST be set and should be a strong password
- In **development**, default credentials are provided for convenience
- **Never** use default credentials in production environments

### Redis Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_PASSWORD` | No | (empty) | Redis authentication password |
| `REDIS_HOST` | No | Service name | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |

## Application Configuration

### API Gateway

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_ENV` | No | `development` | Application environment |
| `APP_PORT` | No | `8080` | Application port |
| `LOG_LEVEL` | No | `debug` (dev), `info` (prod) | Logging level |
| `LOG_FORMAT` | No | `text` (dev), `json` (prod) | Log output format |

### Security & Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | **Production: Yes** | `development-jwt-secret-change-in-production` | JWT signing secret |
| `JWT_EXPIRATION` | No | `24h` (dev), `1h` (prod) | JWT token expiration |
| `JWT_ISSUER` | No | `link-api-gateway-dev` | JWT issuer identifier |

**Security Notes:**
- `JWT_SECRET` MUST be a strong, random string in production
- Use shorter expiration times in production for security

### CORS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | **Production: Yes** | `http://localhost:3000,http://localhost:3001` | Allowed CORS origins |
| `CORS_ALLOWED_METHODS` | No | `GET,POST,PUT,DELETE,OPTIONS` | Allowed HTTP methods |
| `CORS_ALLOWED_HEADERS` | No | `Content-Type,Authorization,X-User-ID,X-Request-ID` | Allowed headers |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_RPS` | No | `100` (dev), `50` (prod) | Requests per second limit |
| `RATE_LIMIT_BURST` | No | `200` (dev), `100` (prod) | Burst capacity |

## Service Discovery & Load Balancing

### Service URLs

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `USER_SVC_URL` | No | `http://link_user_svc:8080` | User service URL |
| `CHAT_SVC_URL` | No | `http://link_chat_svc:8080` | Chat service URL |
| `AI_SVC_URL` | No | `http://link_ai_svc:8000` | AI service URL |
| `DISCOVERY_SVC_URL` | No | `http://link_discovery_svc:8080` | Discovery service URL |
| `LOCATION_SVC_URL` | No | `http://link_location_svc:8080` | Location service URL |
| `OPPORTUNITIES_SVC_URL` | No | `http://link_opportunities_svc:8080` | Opportunities service URL |

### Load Balancer Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEFAULT_LB_STRATEGY` | No | `round-robin` | Load balancing strategy |
| `DEFAULT_LB_MAX_FAILURES` | No | `5` | Max failures before circuit break |
| `DEFAULT_LB_TIMEOUT` | No | `30` | Service timeout in seconds |
| `DEFAULT_LB_RECOVERY_TIMEOUT` | No | `60` | Recovery timeout in seconds |

### Retry Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEFAULT_RETRY_MAX` | No | `3` | Maximum retry attempts |
| `DEFAULT_RETRY_BASE_DELAY` | No | `100` | Base delay in milliseconds |
| `DEFAULT_RETRY_MAX_DELAY` | No | `5000` | Maximum delay in milliseconds |
| `DEFAULT_RETRY_JITTER` | No | `true` | Enable retry jitter |

## Monitoring & Observability

### Metrics & Tracing

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `METRICS_ENABLED` | No | `true` | Enable Prometheus metrics |
| `METRICS_PORT` | No | `8080` | Metrics endpoint port |
| `METRICS_PATH` | No | `/metrics` | Metrics endpoint path |
| `TRACING_ENABLED` | No | `true` | Enable distributed tracing |
| `JAEGER_ENDPOINT` | No | `http://link_jaeger:14268/api/traces` | Jaeger collector endpoint |
| `JAEGER_SAMPLER_RATE` | No | `1.0` | Trace sampling rate |

### Error Reporting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SENTRY_DSN` | **Production: Yes** | (empty) | Sentry error reporting DSN |
| `SENTRY_ENVIRONMENT` | No | `${APP_ENV}` | Sentry environment tag |

### Health Checks

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HEALTH_CHECK_ENABLED` | No | `true` | Enable health check endpoints |
| `HEALTH_CHECK_INTERVAL` | No | `30s` | Health check interval |

## Development Features

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_DEBUG_ENDPOINTS` | No | `true` (dev), `false` (prod) | Enable debug endpoints |
| `ENABLE_PPROF` | No | `true` (dev), `false` (prod) | Enable pprof profiling |
| `ENABLE_REQUEST_LOGGING` | No | `true` (dev), `false` (prod) | Enable request logging |

## External Services

### AI Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | **Yes** | (none) | OpenAI API key for AI service |
| `OPENAI_MODEL` | No | `gpt-3.5-turbo` | OpenAI model to use |

## Environment-Specific Configurations

### Development (.env.development)

```bash
# Development defaults are built into the application
# Override only what you need to change
POSTGRES_PASSWORD=linkpass
JWT_SECRET=development-jwt-secret-change-in-production
LOG_LEVEL=debug
ENABLE_DEBUG_ENDPOINTS=true
```

### Production (.env.production)

```bash
# Required variables (no defaults)
POSTGRES_PASSWORD=your-secure-database-password
JWT_SECRET=your-secure-jwt-secret-minimum-32-chars
CORS_ALLOWED_ORIGINS=https://yourdomain.com
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Optional overrides
APP_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
RATE_LIMIT_RPS=50
JWT_EXPIRATION=1h

# Redis password for production
REDIS_PASSWORD=your-secure-redis-password

# External services
OPENAI_API_KEY=your-openai-api-key
```

### Staging (.env.staging)

```bash
# Staging uses production-like settings with some debugging enabled
POSTGRES_PASSWORD=staging-database-password
JWT_SECRET=staging-jwt-secret-minimum-32-chars
CORS_ALLOWED_ORIGINS=https://staging.yourdomain.com

APP_ENV=staging
LOG_LEVEL=info
SENTRY_DSN=https://your-staging-sentry-dsn@sentry.io/project-id
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique passwords** for all services
3. **Rotate secrets regularly** in production
4. **Use environment-specific configurations**
5. **Validate all environment variables** at startup
6. **Use secrets management systems** in production (e.g., AWS Secrets Manager, HashiCorp Vault)

## Docker Compose Usage

### Development
```bash
# Uses defaults from docker-compose.yml
docker-compose up -d
```

### Production
```bash
# Requires production environment variables
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d
```

### With Environment File
```bash
# Load from specific environment file
docker-compose --env-file .env.production up -d
```

## Troubleshooting

### Common Issues

1. **"POSTGRES_PASSWORD variable is not set"**
   - Set `POSTGRES_PASSWORD` environment variable
   - Or use the default by setting `POSTGRES_PASSWORD=linkpass` for development

2. **JWT authentication failures**
   - Ensure `JWT_SECRET` is set and consistent across all services
   - Check that `JWT_EXPIRATION` format is valid (e.g., "1h", "30m", "24h")

3. **CORS errors in browser**
   - Set `CORS_ALLOWED_ORIGINS` to include your frontend domain
   - Ensure the protocol (http/https) matches

4. **Service discovery failures**
   - Check that service URLs match Docker Compose service names
   - Verify internal Docker network connectivity

For more troubleshooting, see the main README.md file.