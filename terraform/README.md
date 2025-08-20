# Link Database Isolation - Terraform Infrastructure

This Terraform configuration implements the database isolation strategy defined in **ADR-002: Distributed Database Strategy**, creating separate databases for each service within a single PostgreSQL cluster to enable multi-instance deployment.

## 📁 **NEW: Improved Structure**

```
terraform/
├── main.tf                    # Main resource definitions
├── variables.tf               # Input variable definitions  
├── outputs.tf                 # Output definitions
├── locals.tf                  # Local values and common configs
├── providers.tf               # Provider configurations
├── versions.tf                # Terraform and provider version constraints
├── Makefile                   # Environment management commands
├── .tflint.hcl               # Linting configuration
├── environments/              # Environment-specific configurations
│   ├── development/
│   ├── staging/
│   └── production/
└── modules/                   # Reusable Terraform modules
```

## 🎯 Purpose

**Problem**: The current shared database (`link_app`) creates connection pool exhaustion and scaling bottlenecks when deploying multiple instances of services.

**Solution**: Database-per-service within a single PostgreSQL cluster, providing service isolation while maintaining operational simplicity.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL Cluster (Single)                  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐│
│ │ link_users  │ │ link_chat   │ │ link_ai     │ │ link_... │││
│ │ (User Svc)  │ │ (Chat Svc)  │ │ (AI Svc)    │ │ (Others) │││
│ └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘││
└─────────────────────────────────────────────────────────────┘
           │               │               │               │
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ User Service │ │ Chat Service │ │  AI Service  │ │    Others    │
    │ (2 instances)│ │ (2 instances)│ │ (1 instance) │ │              │
    └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Expected Connection Usage:
• Before: 500+ connections with shared database  
• After:  ~90 connections (10 per service × ~9 instances)
```

## 📊 Services Covered

| Service | Database | User | Purpose |
|---------|----------|------|---------|
| **user-svc** | `link_users` | `link_users_user` | User management, authentication, profiles |
| **chat-svc** | `link_chat` | `link_chat_user` | Chat rooms, messages, real-time communication |
| **ai-svc** | `link_ai` | `link_ai_user` | AI processing, privacy/consent management |
| **search-svc** | `link_search` | `link_search_user` | Vector search, embeddings, content indexing |
| **discovery-svc** | `link_discovery` | `link_discovery_user` | User discovery, availability, location features |

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install Terraform
brew install terraform  # macOS
# or
sudo apt-get install terraform  # Ubuntu

# Install PostgreSQL client
brew install postgresql  # macOS
# or  
sudo apt-get install postgresql-client  # Ubuntu

# Ensure PostgreSQL is running and accessible
psql -h localhost -U link_user -d link_app -c "SELECT 1;"
```

### 2. Basic Usage

```bash
# Clone and navigate to terraform directory
cd terraform/

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -var="postgres_password=your_postgres_password"

# Apply the changes
terraform apply -var="postgres_password=your_postgres_password"
```

### 3. Configuration Files

Create a `terraform.tfvars` file:

```hcl
# terraform.tfvars
postgres_host     = "localhost"
postgres_password = "your_postgres_password"
environment       = "development"

# Database settings
database_connection_limit = 100
user_connection_limit     = 50

# Enable features
create_monitoring_user = true
enable_pgbouncer      = true
enable_ssl            = true

# Backup settings
backup_retention_days = 30

# Kubernetes settings (if using K8s)
kubernetes_namespace = "default"
```

## 🔧 Generated Resources

After applying Terraform, the following resources are created:

### Database Resources
- **5 isolated databases** (one per service)
- **5 service users** with appropriate permissions
- **1 monitoring user** (optional) for observability
- **Required extensions** (uuid-ossp, pgvector)

### Configuration Files
- **Environment files**: `.env.users`, `.env.chat`, etc.
- **Kubernetes secrets**: `users-db-credentials.yaml`, etc.
- **Docker Compose override**: `docker-compose.db-isolation.yml`
- **PgBouncer config**: `pgbouncer/pgbouncer.ini`

### Operational Scripts
- **Backup script**: `scripts/backup-databases.sh`
- **Restore script**: `scripts/restore-database.sh` 
- **Migration scripts**: `scripts/migrate-{service}-database.sh`

## 📁 File Structure After Deployment

```
terraform/
├── modules/service-databases/     # Reusable Terraform module
├── scripts/                      # Generated operational scripts
│   ├── backup-databases.sh
│   ├── restore-database.sh
│   └── migrate-*-database.sh
├── pgbouncer/                    # Connection pooling config
│   └── pgbouncer.ini
└── ..env/                       # Service environment files
    ├── .env.users
    ├── .env.chat
    └── ...
```

## 💾 Backup & Recovery Strategy

### Automated Backup

The module generates a comprehensive backup script that:

1. **Individual Database Backups**: Each service database backed up separately
2. **Cluster-wide Backup**: Full PostgreSQL cluster backup for disaster recovery
3. **Retention Management**: Automatic cleanup of old backups
4. **Compression**: Gzipped backups to save space

```bash
# Set up automated backups (cron)
sudo crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /path/to/scripts/backup-databases.sh
```

### Backup Features

- **Incremental**: Individual service database backups
- **Full Cluster**: Complete cluster backup for disaster recovery
- **Compressed**: Automatic gzip compression
- **Retention**: Configurable retention period (default: 30 days)
- **Monitoring**: Backup success/failure logging

### Restore Process

```bash
# Restore a specific service database
./scripts/restore-database.sh users /var/backups/postgresql/link_users_backup_20250119.sql.gz

# Available services: users, chat, ai, search, discovery
```

## 🔄 High Availability & Replicas

### Read Replicas (Future Enhancement)

For production deployments, consider implementing read replicas:

```hcl
# terraform.tfvars (production)
enable_replica_setup = true
environment = "production"
```

### Replica Strategy Options

1. **Service-Specific Replicas**: Each service database gets its own read replica
2. **Shared Read Replica**: Single read replica for all service databases  
3. **Geographic Distribution**: Replicas in different regions

### Connection Routing

```go
// Service database configuration with replica support
type DatabaseConfig struct {
    Primary  string  // Write operations
    Replica  string  // Read operations  
    PoolSize int     // Connection pool size
}
```

## 🐳 Docker Compose Integration

The module generates a Docker Compose override file:

```bash
# Use the generated database isolation configuration
docker-compose -f docker-compose.yml -f docker-compose.db-isolation.yml up
```

## ☸️ Kubernetes Integration

Apply the generated Kubernetes secrets:

```bash
# Apply database credentials to Kubernetes
kubectl apply -f terraform/k8s-secrets/

# Verify secrets are created
kubectl get secrets | grep db-credentials
```

Update your Helm values to use the new secrets:

```yaml
# helm/values.yaml
userService:
  database:
    existingSecret: users-db-credentials

chatService:
  database:
    existingSecret: chat-db-credentials
```

## 🔍 Connection Pooling with PgBouncer

### Configuration

The module generates PgBouncer configuration optimized for multi-instance deployment:

```ini
# Generated pgbouncer/pgbouncer.ini
[databases]
link_users = host=postgres port=5432 dbname=link_users
link_chat = host=postgres port=5432 dbname=link_chat
# ... other databases

[pgbouncer]
pool_mode = session
default_pool_size = 10
max_client_conn = 100
```

### Deploy PgBouncer

```bash
# Using Docker
docker run -d \
  --name pgbouncer \
  -p 6432:5432 \
  -v $(pwd)/pgbouncer/pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini \
  pgbouncer/pgbouncer
```

## 📊 Monitoring & Observability

### Database Metrics

Monitor connection usage per service:

```sql
-- Check active connections per database
SELECT datname, count(*) as connections 
FROM pg_stat_activity 
GROUP BY datname;

-- Monitor connection pool usage
SELECT database, active_connections, waiting_connections 
FROM pgbouncer_pools();
```

### Monitoring User

If enabled, use the monitoring user for observability:

```bash
# Get monitoring credentials
terraform output -json monitoring_user
```

## 🧪 Testing Multi-Instance Deployment

### Validation Steps

1. **Connection Test**: Verify each service can connect to its database
2. **Load Test**: Deploy multiple instances and test connection pooling
3. **Failover Test**: Simulate instance failures and verify recovery

```bash
# Test connection for each service
for service in users chat ai search discovery; do
  echo "Testing $service database connection..."
  PGPASSWORD=$(terraform output -json service_passwords | jq -r ".${service}") \
    psql -h localhost -U "link_${service}_user" -d "link_${service}" -c "SELECT 1;"
done
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Refused**: Check PostgreSQL is running and accessible
2. **Permission Denied**: Verify database user has correct permissions
3. **Too Many Connections**: Implement PgBouncer connection pooling

### Debug Commands

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Monitor connections
SELECT * FROM pg_stat_activity WHERE datname LIKE 'link_%';

# Check database sizes
SELECT datname, pg_size_pretty(pg_database_size(datname)) 
FROM pg_database 
WHERE datname LIKE 'link_%';
```

## 📋 Migration Checklist

- [ ] Run Terraform to create isolated databases
- [ ] Update service configurations to use new database credentials
- [ ] Migrate existing data from shared database
- [ ] Deploy PgBouncer for connection pooling  
- [ ] Test multi-instance deployment
- [ ] Set up automated backups
- [ ] Update monitoring and alerting
- [ ] Document rollback procedures

## 🔗 Related Documentation

- [ADR-002: Distributed Database Strategy](../ADR-002-Distributed-Database-Strategy.md)
- [DESIGN-001: Service Discovery & Load Balancing](../DESIGN-001-Service-Discovery-Load-Balancing.md)
- [Terraform PostgreSQL Provider Docs](https://registry.terraform.io/providers/cyrilgdn/postgresql/latest/docs)

## 🤝 Support

For questions or issues:

1. Check the troubleshooting section above
2. Review the generated `IMPLEMENTATION_GUIDE.md`
3. Consult the ADR-002 document for architectural context

---

**Generated by**: Terraform Service Databases Module  
**Version**: 1.0  
**Last Updated**: 2025-01-19
