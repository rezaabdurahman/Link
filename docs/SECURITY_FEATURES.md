# Security Features: mTLS + Database Isolation

This document describes the implementation of two critical security features:
1. **Automatic mTLS** using Linkerd service mesh
2. **Database isolation** using Terraform-managed credentials

## 🎯 Answer to Your Questions

### **Q1: Is a different Docker Compose needed?**
**A: NO!** Your existing `docker-compose.yml` is already prepared for database isolation. It has all the necessary environment variable placeholders for service-specific database credentials.

### **Q2: What are the Terraform database passwords for?**
**A: Database Isolation Security!** Terraform generates unique 32-character passwords for each service to access only their own isolated database:

- `link_users` database → `link_users_user` → unique password
- `link_chat` database → `link_chat_user` → unique password  
- `link_ai` database → `link_ai_user` → unique password
- `link_search` database → `link_search_user` → unique password
- `link_discovery` database → `link_discovery_user` → unique password

This prevents services from accessing each other's data and follows the principle of least privilege.

## 🚀 Quick Start

### 1. Database Isolation (Docker Compose)
```bash
# Set your PostgreSQL admin password
export POSTGRES_PASSWORD=your_admin_password

# Run the setup script
./scripts/setup-security-features.sh development

# Use your existing Docker Compose with isolation
source .env.db-isolation
docker-compose up
```

### 2. mTLS Service Mesh (Kubernetes)
```bash
# Install Linkerd (requires Kubernetes cluster)
./k8s/linkerd/install-linkerd.sh

# Deploy services with automatic mTLS
kubectl apply -f k8s/linkerd/services-with-mtls.yaml

# Verify mTLS is working
linkerd viz stat deployment -n link-services
```

## 🔐 Security Improvements

### Database Isolation Benefits:
- ✅ **Data Isolation**: Services can only access their own data
- ✅ **Breach Containment**: If one service is compromised, others remain secure
- ✅ **Connection Limits**: Each service has its own connection pool
- ✅ **Secure Credentials**: 32-character random passwords per service
- ✅ **SSL Connections**: All database connections use SSL

### mTLS Benefits:
- ✅ **Zero-Config Security**: Automatic mTLS between all services
- ✅ **Identity Verification**: Services authenticate each other with certificates
- ✅ **Traffic Encryption**: All inter-service communication is encrypted
- ✅ **Automatic Rotation**: Certificates are automatically rotated
- ✅ **Policy Enforcement**: Traffic policies can be applied

## 🏗️ Architecture

### Current State (Before):
```
┌─────────────┐    HTTP     ┌─────────────┐
│ User Service│────────────▶│ Chat Service│
└─────────────┘             └─────────────┘
       │                           │
       ▼                           ▼
┌─────────────────────────────────────────┐
│          Shared Database                │
│     (linkdb - all services)             │
└─────────────────────────────────────────┘
```

### New State (After):
```
┌─────────────┐   mTLS/HTTPS  ┌─────────────┐
│ User Service│◀──────────────▶│ Chat Service│
└─────────────┘   (Linkerd)   └─────────────┘
       │                           │
       ▼ SSL                       ▼ SSL
┌─────────────┐               ┌─────────────┐
│ link_users  │               │ link_chat   │
│   Database  │               │  Database   │
└─────────────┘               └─────────────┘
```

## 📁 Files Created

### Linkerd (mTLS):
- `k8s/linkerd/install-linkerd.sh` - Installation script
- `k8s/linkerd/services-with-mtls.yaml` - Service deployments with Linkerd

### Database Isolation:
- `scripts/setup-security-features.sh` - Combined setup script
- `scripts/test-security-setup.sh` - Verification script
- `terraform/outputs.tf` - Updated with individual service passwords
- `.env.db-isolation` - Generated environment file (after Terraform run)

## 🔧 Usage

### For Development (Docker Compose):
```bash
# 1. Setup database isolation
export POSTGRES_PASSWORD=your_password
./scripts/setup-security-features.sh development

# 2. Start services with isolation
source .env.db-isolation
docker-compose up
```

### For Production (Kubernetes):
```bash
# 1. Setup database isolation
export POSTGRES_PASSWORD=your_secure_password
./scripts/setup-security-features.sh production

# 2. Install Linkerd service mesh
./k8s/linkerd/install-linkerd.sh

# 3. Deploy services with mTLS
kubectl apply -f k8s/linkerd/services-with-mtls.yaml
```

## 🧪 Testing

Run the comprehensive test suite:
```bash
./scripts/test-security-setup.sh
```

This will verify:
- ✅ Database isolation is working
- ✅ mTLS is functioning between services
- ✅ No security misconfigurations

## 🔍 Monitoring

### Database Isolation:
```bash
# Check service-specific database connections
docker-compose logs user-svc | grep "database"
docker-compose logs chat-svc | grep "database"

# Monitor PgBouncer connection pools
docker-compose exec pgbouncer psql -h localhost -p 5432 -U pgbouncer_stats -d pgbouncer -c "SHOW POOLS;"
```

### mTLS (Linkerd):
```bash
# Live traffic monitoring
linkerd viz top -n link-services

# Service communication graph
linkerd viz edges -n link-services

# Service statistics with mTLS status
linkerd viz stat deployment -n link-services

# Launch web dashboard
linkerd viz dashboard
```

## 🎯 Key Advantages

### Third-Party Tooling Benefits:
- **Linkerd**: Battle-tested service mesh used by companies like Microsoft, Paypal
- **Terraform**: Industry-standard infrastructure as code
- **Zero Code Changes**: Your existing services work without modification
- **Gradual Migration**: Can enable features incrementally

### Your Existing Setup is Smart:
- ✅ Docker Compose already has environment variable placeholders
- ✅ Services already expect service-specific database credentials
- ✅ PgBouncer already configured for multiple database pools
- ✅ Kubernetes manifests ready for secrets injection

**Bottom Line**: You designed your system well - it's ready for these security features with minimal changes!

## 🚨 Important Notes

1. **Database Passwords**: Never commit the generated `.env.db-isolation` file
2. **Kubernetes**: mTLS requires a Kubernetes cluster (local or cloud)
3. **Gradual Rollout**: You can enable database isolation first, then add mTLS later
4. **Backward Compatibility**: Legacy database connections still work during migration

## 📚 Additional Resources

- [Linkerd Documentation](https://linkerd.io/2.15/getting-started/)
- [Terraform PostgreSQL Provider](https://registry.terraform.io/providers/cyrilgdn/postgresql/latest/docs)
- [ADR-002: Distributed Database Strategy](./ADR-002-Distributed-Database-Strategy.md)
