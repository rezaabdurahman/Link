# AI Service Deployment Guide

This guide covers the deployment of the AI Service using Docker Compose with environment parity across development, staging, and production.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Quick Start](#quick-start)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Deployment](#environment-deployment)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Overview

The AI Service deployment includes:

- **AI Service**: Main Go application (`ai-svc:latest`)
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Prometheus**: Metrics collection (optional)
- **Grafana**: Monitoring dashboards (optional)
- **Loki/Promtail**: Log aggregation (production only)

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   AI Service    │────│   PostgreSQL    │
│   (Traefik)     │    │   (Go App)      │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               │
                       ┌─────────────────┐
                       │     Redis       │
                       │    (Cache)      │
                       └─────────────────┘
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git
- curl (for health checks)

### For CI/CD

- GitHub repository with Actions enabled
- Docker Hub account or private registry
- Secrets configured in GitHub repository

## Environment Configuration

### Environment Files

Each environment has its own configuration file:

- `.env.development` - Development settings
- `.env.staging` - Staging settings
- `.env.production` - Production settings (secrets should use external vaults)

### Key Configuration Options

| Variable | Development | Staging | Production | Description |
|----------|-------------|---------|------------|-------------|
| `ENVIRONMENT` | development | staging | production | Deployment environment |
| `LOG_LEVEL` | debug | info | warn | Logging verbosity |
| `DB_SSL_MODE` | disable | require | require | Database SSL mode |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | 100 | 120 | 100 | API rate limiting |
| `CORS_ALLOWED_ORIGINS` | localhost:3000 | staging.*.com | *.com | CORS configuration |

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd ai-svc
cp .env.example .env.development
# Edit .env.development with your settings
```

### 2. Deploy Development Environment

```bash
# Using deployment script (recommended)
./scripts/deploy.sh development

# Or using docker-compose directly
docker-compose --env-file .env.development up -d
```

### 3. Verify Deployment

```bash
# Check service health
curl http://localhost:8081/health

# View logs
docker-compose logs -f ai-svc

# Access services
# AI Service: http://localhost:8081
# Redis Commander: http://localhost:8082
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline includes:

1. **Test Phase**
   - Lint code with golangci-lint
   - Run unit tests
   - Run integration tests
   - Security scanning with gosec
   - Vulnerability checking with govulncheck
   - Code coverage analysis

2. **Build Phase**
   - Build Go application
   - Build Docker image with multi-arch support (amd64, arm64)
   - Generate SBOM (Software Bill of Materials)
   - Push to Docker registry

3. **Deploy Phase**
   - Staging deployment (develop branch)
   - Production deployment (main branch)

### Required Secrets

Configure these secrets in your GitHub repository:

```bash
# Docker Registry
DOCKER_USERNAME=your_docker_username
DOCKER_PASSWORD=your_docker_password

# Environment-specific secrets (use GitHub Environments)
DB_PASSWORD=secure_database_password
REDIS_PASSWORD=secure_redis_password
JWT_SECRET=secure_jwt_secret_key
AI_API_KEY=your_openai_api_key
```

### Triggering Deployments

- **Staging**: Push to `develop` branch
- **Production**: Push to `main` branch
- **Feature branches**: Create pull requests for testing

## Environment Deployment

### Development

```bash
# Start with monitoring
./scripts/deploy.sh development --monitoring

# Build local image
./scripts/deploy.sh development --build

# Access services
# AI Service: http://localhost:8081
# Prometheus: http://localhost:9091
# Grafana: http://localhost:3001 (admin/admin123)
# Redis Commander: http://localhost:8082
```

### Staging

```bash
# Deploy with pre-built image
./scripts/deploy.sh staging --registry your-registry.com --version staging-latest

# Deploy with monitoring
./scripts/deploy.sh staging --monitoring --registry your-registry.com --version staging-latest
```

### Production

```bash
# Production deployment with full stack
./scripts/deploy.sh production \
  --registry your-registry.com \
  --version v1.2.3 \
  --monitoring \
  --logging

# Skip database migration if needed
./scripts/deploy.sh production --skip-migration
```

## Monitoring and Logging

### Monitoring Stack

**Prometheus** (Metrics Collection)
- Endpoint: `http://localhost:9091`
- Scrapes metrics from AI service, PostgreSQL, and Redis
- Retention: 15 days (production), 200 hours (dev/staging)

**Grafana** (Dashboards)
- Endpoint: `http://localhost:3001`
- Default credentials: admin/admin123 (development)
- Pre-configured dashboards for service metrics

### Logging Stack (Production Only)

**Loki** (Log Aggregation)
- Centralized logging for all services
- Retention based on storage configuration

**Promtail** (Log Shipping)
- Collects logs from Docker containers
- Ships to Loki for processing

### Key Metrics

- Request rate and latency
- Error rates and status codes
- Database connection pool usage
- Redis cache hit/miss rates
- Memory and CPU utilization
- AI API response times and costs

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check logs
docker-compose logs ai-svc

# Check environment variables
docker-compose config

# Verify health endpoint
curl -v http://localhost:8081/health
```

#### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready -U postgres

# Verify database exists
docker-compose exec postgres psql -U postgres -l

# Check connection from app container
docker-compose exec ai-svc nc -zv postgres 5432
```

#### Redis Connection Issues

```bash
# Test Redis connectivity
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Test from app container
docker-compose exec ai-svc nc -zv redis 6379
```

### Performance Issues

#### High Memory Usage

```bash
# Check container resources
docker stats

# Adjust memory limits in compose files
# See docker-compose.staging.yml or docker-compose.production.yml
```

#### Slow Database Queries

```bash
# Enable PostgreSQL query logging (development)
docker-compose exec postgres psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"

# Monitor slow queries
docker-compose logs postgres | grep "duration:"
```

### Log Analysis

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f ai-svc
docker-compose logs -f postgres
docker-compose logs -f redis

# Search logs for errors
docker-compose logs ai-svc 2>&1 | grep -i error

# Export logs for analysis
docker-compose logs --no-color ai-svc > ai-svc.log
```

## Security Considerations

### Environment Isolation

- Each environment uses separate Docker networks
- Environment-specific container names and volumes
- Isolated secrets and configuration

### Secret Management

**Development**: Secrets in `.env.development` (not committed)

**Staging/Production**: Use external secret management:
- GitHub Secrets for CI/CD
- Kubernetes Secrets
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

### Network Security

- Services communicate over internal Docker network
- Only necessary ports exposed to host
- SSL/TLS enabled in staging and production
- Rate limiting configured

### Image Security

- Multi-stage Docker builds
- Non-root user in containers
- Regular security scanning with Trivy
- SBOM generation for compliance

### Database Security

- Strong authentication (scram-sha-256)
- SSL connections in staging/production
- Regular backups and encryption at rest
- Connection pooling and limits

## Backup and Recovery

### Database Backups

```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres ai_db > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U postgres ai_db < backup.sql
```

### Volume Backups

```bash
# Backup volumes
docker run --rm -v ai_postgres_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres_backup.tar.gz -C /data .

docker run --rm -v ai_redis_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/redis_backup.tar.gz -C /data .
```

## Scaling

### Horizontal Scaling

For production environments, consider:

- Load balancer (Traefik, Nginx, AWS ALB)
- Multiple AI service replicas
- Database read replicas
- Redis Cluster mode
- Container orchestration (Docker Swarm, Kubernetes)

### Vertical Scaling

Adjust resource limits in compose override files:

```yaml
services:
  ai-svc:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## Maintenance

### Updates

```bash
# Update images
docker-compose pull

# Restart services
./scripts/deploy.sh <environment>

# Update specific service
docker-compose up -d ai-svc
```

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes (be careful!)
docker volume prune

# Full cleanup (removes everything)
docker system prune -a
```

For more information, see individual service documentation and the main README.md file.
