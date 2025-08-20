# PgBouncer Connection Pooling for Link Distributed Architecture

This directory contains PgBouncer configuration and deployment files to enable connection pooling for Link's distributed architecture, supporting multiple service instances without database connection exhaustion.

## Overview

PgBouncer serves as a lightweight connection pooler between Link services and PostgreSQL, providing:

- **Connection Pooling**: Efficient reuse of database connections
- **Isolation**: Per-service database pools for better resource management
- **Scalability**: Support for multiple service instances
- **Monitoring**: Comprehensive metrics and alerting
- **High Availability**: Multiple PgBouncer instances with load balancing

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Service     │    │ Service     │    │ Service     │
│ Instance 1  │    │ Instance 2  │    │ Instance N  │
└─────┬───────┘    └─────┬───────┘    └─────┬───────┘
      │                  │                  │
      └──────┬───────────┴──────┬───────────┘
             │                  │
    ┌────────▼──────────────────▼────────┐
    │         PgBouncer Pool              │
    │  ┌─────────────────────────────┐   │
    │  │ user_service:   25 conns    │   │
    │  │ chat_service:   25 conns    │   │
    │  │ ai_service:     25 conns    │   │
    │  │ discovery_service: 25 conns │   │
    │  │ ...                         │   │
    │  └─────────────────────────────┘   │
    └────────┬────────────────────────────┘
             │
    ┌────────▼────────┐
    │   PostgreSQL    │
    │   (Service DBs) │
    └─────────────────┘
```

## Files Structure

```
pgbouncer/
├── Dockerfile                          # PgBouncer container image
├── pgbouncer.ini                       # Main configuration
├── userlist.txt                        # User authentication template
├── startup.sh                          # Container startup script
├── monitoring/
│   ├── grafana-dashboard.json          # Grafana dashboard
│   └── prometheus-alerts.yaml          # Prometheus alerting rules
├── k8s/
│   ├── pgbouncer-configmap.yaml        # Kubernetes configuration
│   ├── pgbouncer-deployment.yaml       # Kubernetes deployment
│   └── pgbouncer-service.yaml          # Kubernetes service
└── README.md                           # This file
```

## Configuration

### Database Pools

PgBouncer is configured with dedicated pools for each service:

| Service | Database | Pool Size | Max Connections |
|---------|----------|-----------|-----------------|
| User Service | `user_service` | 25 | 30 |
| Chat Service | `chat_service` | 25 | 30 |
| AI Service | `ai_service` | 25 | 30 |
| Discovery Service | `discovery_service` | 25 | 30 |
| Search Service | `search_service` | 25 | 30 |
| Location Service | `location_service` | 25 | 30 |
| Stories Service | `stories_service` | 25 | 30 |
| Opportunities Service | `opportunities_service` | 25 | 30 |

### Pool Settings

- **Pool Mode**: `session` - Provides transaction safety
- **Max Client Connections**: 1000 per PgBouncer instance
- **Server Lifetime**: 3600 seconds (1 hour)
- **Server Idle Timeout**: 600 seconds (10 minutes)

## Deployment

### Docker Compose

PgBouncer is automatically included in the docker-compose setup:

```bash
# Build and start with PgBouncer
docker-compose up --build

# PgBouncer will be available on port 5433
# Services can connect through: pgbouncer:5432
```

### Kubernetes

Deploy PgBouncer in Kubernetes:

```bash
# Apply configurations
kubectl apply -f k8s/pgbouncer-configmap.yaml
kubectl apply -f k8s/pgbouncer-deployment.yaml  
kubectl apply -f k8s/pgbouncer-service.yaml

# Check status
kubectl get pods -l app=pgbouncer -n link-internal
kubectl get svc pgbouncer-service -n link-internal
```

### Using Terraform

The Terraform configuration automatically includes PgBouncer setup:

```bash
cd terraform
terraform apply
```

## Service Configuration

Services can connect to their isolated databases through PgBouncer by setting these environment variables:

### Environment Variables

```bash
# For User Service
USER_SERVICE_DB_HOST=pgbouncer
USER_SERVICE_DB_PORT=5432
USER_SERVICE_DB_NAME=user_service
USER_SERVICE_DB_USER=user_service_user
USER_SERVICE_DB_PASSWORD=<generated_password>

# Similar pattern for other services...
```

### Connection Strings

Services use these connection string patterns:

**Docker Compose**:
```
postgresql://user_service_user:password@pgbouncer:5432/user_service?sslmode=disable
```

**Kubernetes**:
```
postgresql://user_service_user:password@pgbouncer-service.link-internal.svc.cluster.local:5432/user_service?sslmode=disable
```

## Monitoring

### Metrics

PgBouncer exposes metrics on port 9127 via the built-in exporter:

- Connection pool utilization
- Client/server connection counts
- Query rates and response times
- Connection wait times
- Error rates

### Grafana Dashboard

Import the dashboard from `monitoring/grafana-dashboard.json` to visualize:

- Connection pool health
- Performance metrics
- Resource utilization
- Historical trends

### Alerting

Configure Prometheus alerts using `monitoring/prometheus-alerts.yaml`:

- Pool exhaustion warnings
- High client wait times
- Connection churn detection
- Service availability monitoring

## Health Checks

PgBouncer includes comprehensive health checks:

### Container Health Check
```bash
# Manual health check
docker exec link_pgbouncer /usr/local/bin/health-check.sh
```

### Kubernetes Readiness/Liveness
```bash
# Check probe status
kubectl describe pod <pgbouncer-pod> -n link-internal
```

### Administrative Queries
```bash
# Connect to PgBouncer admin interface
psql -h localhost -p 5432 -U pgbouncer_stats -d pgbouncer

# Check pool status
SHOW POOLS;
SHOW CLIENTS;
SHOW SERVERS;
SHOW STATS;
```

## Troubleshooting

### Common Issues

**1. Connection Refused**
```bash
# Check if PgBouncer is running
docker logs link_pgbouncer

# Verify port binding
docker port link_pgbouncer
```

**2. Authentication Failed**
```bash
# Check userlist.txt generation
docker exec link_pgbouncer cat /etc/pgbouncer/userlist.txt

# Verify passwords match Terraform output
terraform output pgbouncer_connection_strings
```

**3. Pool Exhaustion**
```bash
# Check pool utilization
psql -h localhost -p 5433 -U pgbouncer_stats -d pgbouncer -c "SHOW POOLS;"

# Identify waiting clients
psql -h localhost -p 5433 -U pgbouncer_stats -d pgbouncer -c "SHOW CLIENTS;"
```

**4. High Connection Churn**
```bash
# Monitor login rate
psql -h localhost -p 5433 -U pgbouncer_stats -d pgbouncer -c "SHOW STATS;"

# Check for connection leaks in services
kubectl logs <service-pod> | grep -i "connection"
```

### Performance Tuning

**Increase Pool Size** (if needed):
```ini
# In pgbouncer.ini
user_service = ... pool_size=50 max_db_connections=60
```

**Adjust Pool Mode**:
- `session`: Full transaction safety (current)
- `transaction`: Better performance, limited transaction support
- `statement`: Highest performance, no transaction support

**Connection Timeouts**:
```ini
# Reduce for faster failure detection
server_idle_timeout = 300
client_login_timeout = 30
```

## Maintenance

### Reloading Configuration
```bash
# Docker Compose
docker exec link_pgbouncer killall -HUP pgbouncer

# Kubernetes
kubectl rollout restart deployment/pgbouncer -n link-internal
```

### Graceful Shutdown
```bash
# Drain connections before shutdown
psql -h localhost -p 5433 -U pgbouncer_admin -d pgbouncer -c "PAUSE;"
# Wait for connections to drain...
psql -h localhost -p 5433 -U pgbouncer_admin -d pgbouncer -c "SHUTDOWN;"
```

### Scaling PgBouncer

**Horizontal Scaling**:
```bash
# Increase replicas in Kubernetes
kubectl scale deployment pgbouncer --replicas=3 -n link-internal
```

**Vertical Scaling**:
```yaml
# Increase resources in deployment
resources:
  requests:
    memory: "128Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "1000m"
```

## Security Considerations

1. **Password Management**: Passwords are generated by Terraform and stored in Kubernetes secrets
2. **Network Isolation**: PgBouncer runs in `link-internal` namespace with network policies
3. **Authentication**: MD5 authentication between services and PgBouncer
4. **SSL/TLS**: Disabled between services and PgBouncer (internal network), enabled to PostgreSQL
5. **Admin Access**: Admin users have restricted access for monitoring only

## Migration Path

1. **Phase 1**: Deploy PgBouncer alongside existing direct connections
2. **Phase 2**: Gradually migrate services to use PgBouncer (canary deployment)
3. **Phase 3**: Monitor and optimize pool configurations
4. **Phase 4**: Remove direct database connections once fully migrated

## Support

For issues related to PgBouncer configuration or deployment:

1. Check the troubleshooting section above
2. Review PgBouncer logs for error messages
3. Validate environment variables and connection strings
4. Monitor Grafana dashboard for performance insights
5. Consult PgBouncer official documentation: https://www.pgbouncer.org/
