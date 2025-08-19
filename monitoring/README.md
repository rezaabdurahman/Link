# Link Monitoring Stack

This directory contains Docker Compose configurations and configuration files for the Link application monitoring infrastructure.

## Quick Start

### Secure Production Setup (Recommended)
```bash
# Start secure monitoring stack with authentication
docker-compose -f docker-compose.monitoring.secure.yml up -d

# Access via: https://monitoring.linkapp.local/grafana/
# (Add monitoring.linkapp.local to /etc/hosts)
```

### Development Setup
```bash
# Start basic monitoring (development only)
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana: http://localhost:3001
```

## Components

- **Prometheus**: Metrics collection (`:9090`)
- **Grafana**: Visualization dashboards (`:3000`) 
- **Jaeger**: Distributed tracing (`:16686`)
- **AlertManager**: Alert management (`:9093`)
- **Nginx Proxy**: Authentication & SSL termination (`:443`)

## Configuration Files

- `prometheus/prometheus.yml` - Metrics scraping configuration
- `grafana/dashboards/` - Pre-built monitoring dashboards
- `alerting-rules/` - Prometheus alerting rules
- `nginx/` - Reverse proxy configuration

## Documentation

For complete setup instructions, security configuration, and troubleshooting guides, see:
**[docs/architecture/observability.md](../docs/architecture/observability.md)**
