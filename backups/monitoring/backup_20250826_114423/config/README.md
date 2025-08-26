# Link Monitoring & Observability Stack

## 📊 Overview

This directory contains the complete monitoring and observability infrastructure for the Link application, providing comprehensive monitoring, logging, tracing, and alerting across all environments.

## 🏗️ Architecture

### Core Components

- **📈 Prometheus**: Metrics collection and storage
- **📊 Grafana**: Visualization and dashboards  
- **🚨 AlertManager**: Alert routing and management
- **📝 Loki**: Log aggregation and querying
- **🚚 Promtail**: Log shipping agent
- **🔍 Jaeger**: Distributed tracing
- **📡 Exporters**: Infrastructure metrics (Node, cAdvisor, PostgreSQL, Redis)

### Service Integration

All backend services expose `/metrics` endpoints with comprehensive metrics:
- **api-gateway**: HTTP requests, JWT validation, proxy metrics
- **user-svc**: User operations, authentication metrics
- **chat-svc**: WebSocket connections, message delivery
- **discovery-svc**: Broadcast operations, availability tracking
- **search-svc**: Search queries, indexing operations
- **ai-svc**: AI requests, token usage, model performance

## 🚀 Quick Start

### Local Development

```bash
# Start backend services
cd backend && docker-compose up -d

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml -f docker-compose.local.yml up -d

# Access monitoring interfaces
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin)
# AlertManager: http://localhost:9093
# Loki: http://localhost:3100
# Jaeger: http://localhost:16686
```

### Staging Deployment

```bash
# Deploy to staging with environment-specific config
docker-compose -f docker-compose.monitoring.yml -f docker-compose.staging.yml up -d
```

### Production Deployment

```bash
# Production deployment (requires proper secrets)
docker-compose -f docker-compose.monitoring.yml -f docker-compose.production.yml up -d
```

### Secure Production Setup (Alternative)
```bash
# Start secure monitoring stack with authentication
docker-compose -f docker-compose.monitoring.secure.yml up -d

# Access via: https://monitoring.linkapp.local/grafana/
# (Add monitoring.linkapp.local to /etc/hosts)
```

## 📋 Environment Configurations

### Local Development
- **Retention**: 7 days
- **Ports**: All exposed for easy access
- **Security**: Relaxed for development
- **Resources**: No limits

### Staging
- **Retention**: 14-30 days
- **Ports**: Some exposed for debugging
- **Security**: Moderate
- **Resources**: Limited but sufficient

### Production
- **Retention**: 30-90 days
- **Ports**: None exposed (internal only)
- **Security**: Strict with authentication
- **Resources**: Full limits and reservations
- **Backup**: Automated with retention policies

## 🎯 Service Level Objectives (SLOs)

### API Services
- **Availability**: 99.9% uptime
- **Latency**: P95 < 200ms, P99 < 500ms
- **Error Rate**: < 0.1%

### Individual Services
- **User Service**: 99.5% availability
- **Chat Service**: 99.0% message delivery
- **Search Service**: 98.0% query success
- **AI Service**: 95.0% processing success
- **Database**: 99.8% query success

### Error Budget Monitoring
- **Fast Burn**: Alert if budget exhausted in < 1 hour
- **Moderate Burn**: Alert if budget exhausted in < 6 hours
- **Slow Burn**: Monitor for trends over 3 days

## 🔍 Metrics & Dashboards

### Available Dashboards
1. **SLO Overview**: Service level objectives and error budgets (`slo-dashboard.json`)
2. **Service Health**: Individual service metrics and health
3. **Infrastructure**: System resources and database performance (`database-performance.json`)
4. **Logs Overview**: Log aggregation and analysis (`logs-overview.json`)
5. **Security**: Authentication, authorization, and security events

### Key Metrics

#### HTTP Metrics (All Services)
```promql
# Request rate
rate(service_http_requests_total[5m])

# Error rate  
rate(service_http_requests_total{status_code=~"5.."}[5m]) / rate(service_http_requests_total[5m])

# Latency (P95)
histogram_quantile(0.95, rate(service_http_request_duration_seconds_bucket[5m]))
```

#### Business Metrics
```promql
# Chat message delivery rate
rate(chat_svc_messages_total{operation="send", result="success"}[5m])

# Search query success rate
rate(search_svc_queries_total{result="success"}[5m])

# AI processing success rate
rate(ai_svc_ai_requests_total{result="success"}[5m])
```

## 🚨 Alerting

### Alert Severity Levels

#### Critical (PagerDuty + Phone + Email)
- Service completely down
- Database unavailable
- Security breaches
- SLO breaches (availability < 99.9%)

#### Warning (Slack + Email)
- High error rates
- Slow response times
- Resource constraints
- Approaching SLO limits

#### Info (Slack only)
- Slow error budget burn
- Performance degradation
- Configuration changes

### Alert Channels by Environment

#### Local Development
- Console output only

#### Staging
- Slack: `#link-staging-alerts`
- Email: `dev-team@yourdomain.com`

#### Production
- **Critical**: PagerDuty + Phone + Email + Slack (`#link-critical-production`)
- **Warning**: Email + Slack (`#link-production-alerts`)
- **Security**: Dedicated security team channels
- **Database**: DBA team notifications

## 📝 Logging

### Structured Logging
All services use structured JSON logging compatible with Loki:

```json
{
  "time": "2024-01-15T10:30:00.123456789Z",
  "level": "info",
  "msg": "HTTP request completed",
  "service": "user-svc",
  "environment": "production",
  "request_id": "req-123",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "url": "/api/v1/users/profile",
  "status": 200,
  "duration_ms": 45
}
```

### Log Configuration Files
- `promtail.yml` - Local development log shipping
- `promtail-staging.yml` - Staging environment configuration  
- `promtail-production.yml` - Production with PII masking
- `loki/` - Environment-specific Loki configurations

## 🔍 Distributed Tracing

### OpenTelemetry Integration
- **Jaeger UI**: http://localhost:16686 (local)
- **Trace Correlation**: Logs linked to traces via trace_id
- **Service Maps**: Automatic dependency discovery
- **Performance Analysis**: Request flow and bottlenecks

## 🧪 Testing & Validation

### Smoke Tests
```bash
# Run comprehensive monitoring stack tests
./scripts/smoke-test-monitoring.sh local

# Test specific environment
./scripts/smoke-test-monitoring.sh staging
./scripts/smoke-test-monitoring.sh production
```

### CI/CD Integration
- **Config Validation**: All monitoring configs validated on PR
- **Metrics Tests**: Service endpoints tested in CI
- **Alert Validation**: Alert rules syntax checked
- **Deployment Tests**: Health checks post-deployment

## 📁 Configuration Files

### Core Configuration
- `prometheus/prometheus.yml` - Main Prometheus configuration
- `prometheus/rules/` - Alert rules directory
  - `service_alerts.yml` - Service health alerts
  - `database_alerts.yml` - Database performance alerts  
  - `slo_alerts.yml` - SLO and error budget alerts
- `alertmanager/` - Alert routing configurations
  - `alertmanager.yml` - Local development
  - `staging-alertmanager.yml` - Staging environment
  - `production-alertmanager.yml` - Production with PagerDuty

### Security Configuration
- `nginx/` - Reverse proxy configuration with authentication
- `secrets/` - Secret management for secure deployments

## 🤝 Contributing

### Adding New Metrics
1. Define metrics in service's metrics middleware
2. Add to shared-libs if reusable
3. Update Prometheus configuration
4. Create/update Grafana dashboard
5. Add relevant alerts

### Creating Dashboards
1. Use service-specific prefixes for consistency
2. Include SLO-related panels
3. Add proper thresholds and colors
4. Test with different time ranges
5. Document in this README

### Alert Guidelines
1. Every alert must be actionable
2. Include runbook links
3. Set appropriate severity levels
4. Test alert routing
5. Regular review to prevent fatigue

## 📞 Support & Documentation

- **Runbooks**: https://runbooks.yourdomain.com
- **Dashboards**: https://grafana.yourdomain.com
- **Incident Channel**: `#link-incidents`
- **Team**: `@link-sre-team`
- **Architecture Docs**: [docs/architecture/observability.md](../docs/architecture/observability.md)

For complete setup instructions, security configuration, and troubleshooting guides, see the architecture documentation.
