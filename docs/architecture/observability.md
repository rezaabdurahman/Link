# 🎯 Link Monitoring & Observability Stack

Complete observability solution for the Link microservices architecture with security hardening, distributed tracing, and comprehensive monitoring.

## 📚 Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[Security Assessment](./OBSERVABILITY_SECURITY_ASSESSMENT.md)** | Security vulnerabilities and hardening | Before production deployment |
| **[Reverse Proxy Guide](./REVERSE_PROXY_ACCESS_GUIDE.md)** | How to access secure monitoring stack | When setting up secure monitoring |
| **[Logging Setup](./LOKI_LOGGING_SETUP.md)** | Loki/Promtail log aggregation | For centralized logging |

## 🚀 Quick Start

### Option 1: Secure Stack (Recommended)
```bash
# 1. Run security setup
./monitoring/setup-secure-monitoring.sh

# 2. Add to hosts file
echo "127.0.0.1 monitoring.linkapp.local" | sudo tee -a /etc/hosts

# 3. Start secure stack
docker-compose -f monitoring/docker-compose.monitoring.secure.yml up -d

# 4. Access via browser (with auth)
open https://monitoring.linkapp.local/grafana/
```

### Option 2: Basic Stack (Development Only)
```bash
# Start basic monitoring stack (insecure!)
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Access directly (no auth - NEVER use in production)
open http://localhost:3001  # Grafana
```

## 🏗️ Architecture Overview

### Monitoring Components
```
┌─────────────────┐    HTTPS/443    ┌──────────────────┐    HTTP     ┌─────────────┐
│   Your Browser  │◄─────────────────│  Nginx Proxy    │◄─────────────│  Grafana    │
│                 │                  │                  │             │   :3000     │
└─────────────────┘                  │  Authentication  │             └─────────────┘
                                     │  TLS Termination │             
                                     │  Rate Limiting   │    HTTP     ┌─────────────┐
                                     │                  │◄─────────────│ Prometheus  │
                                     └──────────────────┘             └─────────────┘
```

### Service Stack
| Service | Purpose | Port | Secure Access |
|---------|---------|------|---------------|
| **Nginx Proxy** | Authentication & SSL termination | 443 | Entry point |
| **Grafana** | Dashboards & visualization | 3000 | `/grafana/` |
| **Prometheus** | Metrics collection & alerting | 9090 | `/prometheus/` |
| **Jaeger** | Distributed tracing | 16686 | `/jaeger/` |
| **AlertManager** | Alert routing & notifications | 9093 | `/alertmanager/` |

## 🛡️ Security Features

### ✅ Implemented Security Measures
- **Authentication**: HTTP Basic Auth for all endpoints
- **Encryption**: HTTPS with TLS 1.2/1.3
- **Network Isolation**: Internal Docker networks
- **Secrets Management**: Docker secrets for credentials
- **Container Security**: Non-root users, read-only filesystems
- **Rate Limiting**: Protection against abuse
- **Data Sanitization**: PII protection in traces
- **Reduced Retention**: Limited data storage

### ❌ Security Issues Fixed
- ~~No authentication~~ → Basic Auth + HTTPS
- ~~Plain text passwords~~ → Docker secrets
- ~~Privileged containers~~ → Non-root users
- ~~Direct port exposure~~ → Reverse proxy
- ~~Sensitive data in traces~~ → Data sanitization
- ~~Long retention periods~~ → Reduced to 7 days

## 📊 Observability Features

### 🎯 Metrics & Monitoring
- **Application Metrics**: Request rates, response times, error rates
- **Infrastructure Metrics**: CPU, memory, disk, network usage
- **Business Metrics**: User registrations, API usage, feature adoption
- **Database Metrics**: Connection pools, query performance
- **Custom Metrics**: Service-specific KPIs

### 🔍 Distributed Tracing
- **OpenTelemetry Integration**: OTLP exporter with Jaeger
- **Automatic Tracing**: HTTP requests, database queries
- **Manual Spans**: Custom instrumentation for key operations
- **Context Propagation**: Request tracking across services
- **Performance Analysis**: Latency breakdown and bottlenecks

### 📝 Structured Logging
- **Correlation IDs**: Request tracking across services
- **Contextual Data**: User ID, method, path, status
- **JSON Format**: Machine-readable logs
- **Log Levels**: Environment-specific verbosity
- **Error Correlation**: Link errors with traces

### 🚨 Intelligent Alerting
- **Multi-level Alerts**: Critical, Warning, Info
- **Smart Routing**: Severity-based notification channels
- **Multiple Channels**: Email, Slack, Webhooks, PagerDuty
- **Alert Grouping**: Prevent notification spam
- **Auto-resolution**: Notifications when issues resolve

## 🔧 Configuration

### Environment Variables (Secure Stack)
```bash
# Authentication
GRAFANA_ADMIN_USER=admin
MONITORING_USERNAME=admin
MONITORING_PASSWORD=<generated>

# Alerting
ALERT_EMAIL=admin@yourcompany.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
WEBHOOK_URL=https://your-webhook-endpoint.com/alerts

# Tracing
TRACING_ENABLED=true
TRACING_SAMPLING_RATE=0.1  # 10% in production
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://jaeger:4318/v1/traces
```

### Alert Rules Examples
```yaml
groups:
- name: service-health
  rules:
  - alert: ServiceDown
    expr: up == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Service {{ $labels.instance }} is down"
      
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate: {{ $value }}%"
```

## 🎛️ Dashboard Templates

### Pre-built Dashboards
1. **Service Overview**: High-level health and performance
2. **Infrastructure**: System resources and container metrics  
3. **Database**: PostgreSQL and Redis performance
4. **Application**: Request patterns and user behavior
5. **Tracing**: Distributed trace analysis
6. **Security**: Authentication attempts and rate limits

### Custom Metrics Integration
```go
// Example: Custom business metrics
businessMetrics := prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "user_registrations_total",
        Help: "Total number of user registrations",
    },
    []string{"method", "status"},
)

// Record metric
businessMetrics.WithLabelValues("email", "success").Inc()
```

## 🔍 Troubleshooting

### Common Issues

#### Can't Access Secure Stack
```bash
# Check proxy status
docker ps | grep monitoring-proxy

# Check certificates
openssl s_client -connect monitoring.linkapp.local:443

# Check hosts file
grep monitoring /etc/hosts
```

#### Metrics Not Appearing
```bash
# Check service /metrics endpoints
curl http://localhost:8080/metrics  # API Gateway
curl http://localhost:8081/metrics  # User Service

# Check Prometheus targets
curl http://monitoring.linkapp.local/prometheus/targets
```

#### Traces Not Showing
```bash
# Check Jaeger receiver
docker logs link_jaeger

# Test trace endpoint
curl -X POST http://localhost:4318/v1/traces

# Check service tracing config
grep -r "TRACING_ENABLED" backend/
```

## 🚀 Production Deployment

### Security Checklist
- [ ] Replace self-signed certificates with CA-signed
- [ ] Use real domain name instead of `.local`
- [ ] Configure proper DNS records
- [ ] Set up external secrets management
- [ ] Enable log monitoring for security events
- [ ] Configure backup and disaster recovery
- [ ] Implement network segmentation

### Performance Optimization
- [ ] Configure Prometheus remote storage
- [ ] Set up Grafana clustering
- [ ] Optimize alert rule efficiency
- [ ] Implement log rotation policies
- [ ] Configure resource limits
- [ ] Set up monitoring for monitoring

### Compliance Requirements
- [ ] Data retention policies
- [ ] PII data handling
- [ ] Audit logging
- [ ] Access control documentation
- [ ] Security incident procedures
- [ ] Regular security assessments

## 📈 Scaling Considerations

### Multi-Environment Setup
```bash
# Development
docker-compose -f monitoring/docker-compose.monitoring.yml up -d

# Staging
docker-compose -f monitoring/docker-compose.monitoring.secure.yml up -d

# Production
# Use external Prometheus, Grafana Cloud, or managed services
```

### Resource Planning
| Component | CPU | Memory | Storage | Scaling |
|-----------|-----|---------|---------|---------|
| Prometheus | 0.5-2 cores | 2-8GB | 10GB/day | Horizontal (federation) |
| Grafana | 0.25-1 core | 512MB-2GB | 1GB | Vertical |
| Jaeger | 0.5-1 core | 1-4GB | 5GB/day | Horizontal |
| AlertManager | 0.1-0.5 cores | 256MB-1GB | 100MB | Cluster mode |

## 📞 Support & Maintenance

### Daily Operations
- Monitor alert notifications
- Check dashboard for anomalies
- Review error logs in Sentry
- Validate backup operations

### Weekly Maintenance
- Review alert threshold tuning
- Analyze performance trends
- Update dashboard configurations
- Test disaster recovery procedures

### Monthly Reviews
- Security assessment updates
- Performance optimization
- Documentation updates
- Cost optimization review

---

## 🔗 Quick Links

- **Secure Access**: `https://monitoring.linkapp.local/grafana/`
- **Jaeger UI**: `https://monitoring.linkapp.local/jaeger/`
- **Prometheus**: `https://monitoring.linkapp.local/prometheus/`
- **Documentation**: `./monitoring/` directory

## 🎯 Getting Help

1. **Check this documentation** for common solutions
2. **Review Grafana dashboards** for system overview
3. **Check AlertManager** for active alerts
4. **Review structured logs** with correlation IDs
5. **Contact DevOps team** with specific correlation IDs and timestamps

---

**🛡️ Security Notice**: Always use the secure stack (`docker-compose.monitoring.secure.yml`) for production deployments. The basic stack is for development only and has critical security vulnerabilities.

**🎉 Happy Monitoring!** Your microservices are now equipped with enterprise-grade observability and security.
