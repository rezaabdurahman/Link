# Monitoring Stack Cost Optimization

This directory contains a **minimal-by-default** monitoring system that reduces costs by 40-70% while preserving all configuration for potential reactivation.

## 💡 **TL;DR - What Changed**

**Before**: Complex setup, everything runs by default, high costs  
**After**: `docker compose up` gives you minimal monitoring that just works!

- **Default**: Prometheus + Grafana (70% cost savings) 
- **Upgrade**: Add `--profile standard` when you need more
- **Debug**: Add `--profile full` for complete observability

## 🚀 Quick Start (Simplified!)

### Docker Compose (Local Development)

```bash
# DEFAULT: Minimal monitoring (just works!)
docker compose up

# UPGRADE: When you need more visibility  
docker compose --profile standard up

# DEBUG MODE: Full observability
docker compose --profile full up
```

### Kubernetes (Production)

```bash
# Apply minimal profile to K8s cluster
./scripts/k8s-monitoring-control.sh minimal

# Apply standard profile to K8s cluster
./scripts/k8s-monitoring-control.sh standard

# Show cost estimates
./scripts/k8s-monitoring-control.sh costs standard
```

## Profiles Overview

| Profile | Docker Command | Components | Retention | Storage | Cost Reduction |
|---------|---------------|------------|-----------|---------|----------------|
| **Default (Minimal)** | `docker compose up` | Prometheus + Grafana | 3 days | ~15GB | 70% |
| **Standard** | `docker compose --profile standard up` | + Loki + Jaeger + Exporters | 7 days | ~80GB | 40% |
| **Full** | `docker compose --profile full up` | All components | 14 days | ~200GB | 0% (optimized) |

## What's Different

### ✅ What We Preserved
- **All configuration code** - nothing deleted, just commented/disabled
- **Easy reactivation** - single command to restore full monitoring
- **Automatic backups** - data preserved when switching profiles
- **Production readiness** - standard profile suitable for production

### 💰 How We Reduced Costs
- **Conditional service activation** using Docker profiles
- **Dynamic retention policies** (30d → 3-14d)
- **Optimized resource allocations** (50% less RAM/CPU)
- **Service consolidation** (disabled redundant exporters)

### 🛠 Implementation Details
- **Environment-driven configuration** via `.env.profiles`
- **Profile-specific configs** for Prometheus/Loki
- **Kubernetes resource optimization** with dynamic limits
- **ArgoCD integration** for production deployments

## Configuration Files

```
monitoring/
├── .env.profiles                    # Profile configurations
├── docker-compose.monitoring.yml   # Updated with profiles
├── docker-compose.custom.yml       # Custom profile overrides
├── prometheus/
│   ├── minimal-prometheus.yml       # Minimal config
│   ├── standard-prometheus.yml      # Standard config
│   └── prometheus.yml.original      # Original (full) config
├── loki/
│   ├── minimal-config.yaml          # 1-day retention
│   ├── standard-config.yaml         # 3-day retention
│   └── local-config.yaml.original   # Original config
└── README-PROFILES.md               # This file
```

## Migration Path

### 🎯 **New Approach (Recommended)**
```bash
# Start with minimal monitoring (default)
docker compose up

# Upgrade when you need more data
docker compose down
docker compose --profile standard up

# Full debugging when issues arise
docker compose down  
docker compose --profile full up
```

### 🔧 **Advanced Migration (Script-based)**
```bash
# Backup current setup
./scripts/monitoring-control.sh backup

# Apply profiles via script (manages backups automatically)
./scripts/monitoring-control.sh standard

# Quick status check
./scripts/monitoring-control.sh status
```

## Custom Configuration

Create your own profile by selecting specific components:

```bash
# Interactive configuration
./scripts/monitoring-control.sh configure

# Apply custom profile
./scripts/monitoring-control.sh custom
```

Or set environment variables manually:
```bash
export CUSTOM_LOKI_ENABLED=true
export CUSTOM_JAEGER_ENABLED=false
export CUSTOM_PROMETHEUS_RETENTION=5d
./scripts/monitoring-control.sh custom
```

## Cost Estimates

Based on typical cloud provider pricing:

### Docker Compose (Local)
- **Minimal**: ~2GB RAM, 15GB disk
- **Standard**: ~6GB RAM, 80GB disk  
- **Full**: ~16GB RAM, 200GB disk

### Kubernetes (Cloud)
- **Minimal**: ~$50/month (2 vCPU, 4GB RAM, 20GB disk)
- **Standard**: ~$120/month (4.5 vCPU, 9GB RAM, 80GB disk)
- **Full**: ~$200/month (9 vCPU, 18GB RAM, 200GB disk)

## Troubleshooting

### Services Won't Start
```bash
# Check profile configuration
./scripts/monitoring-control.sh status

# View service logs
./scripts/monitoring-control.sh logs prometheus

# Restart specific service
./scripts/monitoring-control.sh restart grafana
```

### Missing Configuration
```bash
# Restore from backup
ls -la backups/monitoring/
# Copy desired backup config files

# Or regenerate configs
./scripts/monitoring-control.sh full
./scripts/monitoring-control.sh standard
```

### Resource Issues
```bash
# Check Docker resource usage
docker stats

# Reduce to minimal profile temporarily
./scripts/monitoring-control.sh minimal

# Clean up old data
./scripts/monitoring-control.sh stop
docker volume prune
```

## Next Steps

1. **Test the system** with your current workload
2. **Monitor cost impact** over 1-2 weeks
3. **Adjust profiles** based on actual needs
4. **Consider alerts** for when you need full monitoring temporarily

For questions or issues, check the main project documentation or create an issue.