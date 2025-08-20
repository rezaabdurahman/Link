# 🐳 Link API Gateway - Docker Setup Guide

This guide covers the Docker setup and containerization for the Link API Gateway with integrated load balancing, circuit breakers, and monitoring.

## 📋 Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Make (for automation scripts)
- Access to existing Link project infrastructure

## 🚀 Quick Start

### Option 1: Integrate with Existing Infrastructure (Recommended)

The API Gateway is designed to work with the existing Link project infrastructure:

```bash
# From the API Gateway directory
make project-up

# This will start:
# - All existing backend services (user-svc, chat-svc, etc.)
# - Enhanced API Gateway with load balancing
# - Full monitoring stack (Prometheus, Grafana, Jaeger)
# - PostgreSQL and Redis
```

### Option 2: Standalone Development

For isolated API Gateway development:

```bash
make up-standalone
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway    │    │  Backend Svcs   │
│  (port 3000)    │────▶│  Enhanced v2.0   │────▶│  user-svc:8081  │
└─────────────────┘    │  (port 8080)     │    │  chat-svc:8083  │
                       │                  │    │  ai-svc:8084    │
┌─────────────────┐    │  ┌─────────────┐ │    │  discovery:8087 │
│   Monitoring    │    │  │ Load Balancer│ │    │  location:8082  │
│  Grafana :3001  │◀───┤  │ Circuit Break│ │    │  stories:8085   │
│  Prometheus:9090│    │  │ Retry Logic  │ │    │  opportunities │
│  Jaeger :16686  │    │  └─────────────┘ │    │     :8086       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ▼
                       ┌──────────────────┐
                       │   Infrastructure │
                       │  PostgreSQL:5432 │
                       │  Redis:6379      │
                       │  PgBouncer:5433  │
                       └──────────────────┘
```

## 📁 File Structure

```
backend/api-gateway/
├── docker-compose.yml           # Standalone development
├── docker-compose.override.yml  # Override for main project
├── .env.development            # Dev environment variables
├── .env.production            # Prod environment variables
├── Dockerfile                 # Multi-stage container build
├── Makefile                  # Automation commands
└── DOCKER_SETUP.md          # This file
```

## 🔧 Configuration

### Environment Variables

The API Gateway supports configuration via environment variables:

#### Core Configuration
- `APP_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (debug/info/warn/error)
- `JWT_SECRET`: JWT signing secret

#### Service Discovery
- `USER_SVC_URL`: User service endpoint
- `CHAT_SVC_URL`: Chat service endpoint  
- `AI_SVC_URL`: AI service endpoint
- And similar for other services...

#### Load Balancer Settings
- `DEFAULT_LB_STRATEGY`: Strategy (round-robin/least-connections/random)
- `DEFAULT_LB_MAX_FAILURES`: Max failures before circuit breaking
- `DEFAULT_LB_TIMEOUT`: Request timeout in seconds
- `DEFAULT_LB_RECOVERY_TIMEOUT`: Circuit breaker recovery time

#### Multiple Instances (Production)
For production load balancing across multiple instances:
```bash
USER_SVC_INSTANCES=user-1:user-svc-1:8080,user-2:user-svc-2:8080,user-3:user-svc-3:8080
```

### Environment Files

Load environment-specific configs:
```bash
# Development
docker-compose --env-file .env.development up

# Production  
docker-compose --env-file .env.production up
```

## 🎯 Docker Compose Usage

### Main Project Integration

Use with the existing project infrastructure:

```bash
# Start everything (recommended)
make project-up

# View logs
make project-logs

# Stop everything
make project-down
```

This uses both:
- `../../../docker-compose.yml` (main project)
- `docker-compose.override.yml` (API Gateway enhancements)

### Standalone Mode

For API Gateway development only:

```bash
# Start API Gateway with minimal dependencies
make up-standalone

# View logs
make logs-standalone

# Stop
make down-standalone
```

## 📊 Monitoring Integration

The API Gateway integrates with the existing monitoring stack:

### Prometheus Metrics

Metrics are automatically scraped by Prometheus:
- **Endpoint**: `http://localhost:8080/metrics`
- **Custom Metrics**: Request counts, duration, circuit breaker states, retry attempts

### Grafana Dashboards

View the API Gateway dashboard at:
- **URL**: `http://localhost:3001`
- **Credentials**: admin/admin123 (development)

### Jaeger Tracing

Distributed tracing is available at:
- **URL**: `http://localhost:16686`
- **Integration**: Automatic request tracing across services

## 🧪 Development Workflows

### Hot Reload Development

```bash
# Setup development environment
make dev-setup

# Start with hot reload (requires air)
make dev

# Run tests
make test

# View health status
make health
```

### Testing

```bash
# Run all tests
make test

# Integration tests only
make test-integration

# Configuration tests only
make test-config
```

### Docker Development

```bash
# Build Docker image
make docker-build

# Run containerized locally
make docker-run

# Push to registry (configure DOCKER_REGISTRY first)
make docker-push
```

## 🚀 Production Deployment

### AWS ECR Integration

Configure for AWS deployment:

```bash
# Update Makefile with your registry
DOCKER_REGISTRY := 123456789.dkr.ecr.us-west-2.amazonaws.com

# Build and push
make docker-push
```

### Production Environment

Use production configuration:

```bash
# Copy and customize production env
cp .env.production .env.production.local

# Deploy with production settings
APP_ENV=production make up
```

### Resource Requirements

Recommended production resources:
- **CPU**: 1-2 cores per instance
- **Memory**: 512MB - 1GB per instance
- **Storage**: 10GB for logs and temporary files
- **Network**: Load balancer support

## 🔍 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check what's using port 8080
   lsof -i :8080
   
   # Use different port
   API_GATEWAY_PORT=8081 make up
   ```

2. **Network Issues**
   ```bash
   # Recreate networks
   make clean-all
   make project-up
   ```

3. **Service Dependencies**
   ```bash
   # Check service health
   make health
   
   # View service logs
   make logs
   ```

4. **Memory Issues**
   ```bash
   # Check container resource usage
   docker stats
   
   # Adjust memory limits in compose file
   ```

### Health Checks

```bash
# API Gateway health
curl http://localhost:8080/health

# Metrics endpoint
curl http://localhost:8080/metrics

# Debug endpoint (development only)
curl http://localhost:8080/debug/vars
```

### Log Analysis

```bash
# Real-time logs
make logs

# Specific service logs
docker-compose logs -f api-gateway

# Export logs
docker-compose logs api-gateway > api-gateway.log
```

## 📚 Next Steps

1. **Kubernetes Setup**: See `/k8s` directory for Kubernetes manifests
2. **Helm Charts**: Check `/helm` directory for templated deployments  
3. **CI/CD Integration**: GitHub Actions workflows in `/.github/workflows`
4. **Production Monitoring**: Grafana dashboard configurations in `/monitoring/grafana/dashboards`

## 🆘 Support

For issues and questions:
- Check existing logs with `make logs`
- Run health checks with `make health`  
- Review configuration in environment files
- Verify network connectivity between services

---

**🎉 You now have a fully containerized, production-ready API Gateway with load balancing, circuit breakers, and comprehensive monitoring!**
