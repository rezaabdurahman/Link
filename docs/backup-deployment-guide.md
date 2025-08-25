# Complete Backup & DR Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the complete backup and disaster recovery system for the Link application.

## Prerequisites

Before starting, ensure you have:

- ✅ **Kubernetes cluster** with admin access
- ✅ **kubectl** configured for your cluster  
- ✅ **AWS CLI** configured with appropriate permissions
- ✅ **Terraform** installed (v1.0+)
- ✅ **Docker** for building custom backup images (optional)
- ✅ **AWS S3 bucket permissions** for backup storage
- ✅ **openssl** for generating secure passwords

## Quick Setup (Automated)

For a fully automated deployment:

```bash
# Run the complete setup script
./scripts/setup-backup-infrastructure.sh
```

This script will:
1. Check prerequisites
2. Collect configuration from you
3. Deploy all components in correct order
4. Test the backup system
5. Provide a summary report

## Manual Setup (Step-by-Step)

If you prefer manual control over the deployment:

### Step 1: Deploy Prerequisites

```bash
# Create namespace and storage classes
kubectl apply -f k8s/00-prerequisites.yaml

# Verify storage classes are created
kubectl get storageclass
```

### Step 2: Create Required Secrets

```bash
# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)  
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Create secrets with your values
kubectl create secret generic postgres-secret \
  --from-literal=database="linkdb" \
  --from-literal=username="linkuser" \
  --from-literal=password="$POSTGRES_PASSWORD" \
  --from-literal=replication-username="replicator" \
  --from-literal=replication-password="$(openssl rand -base64 32)" \
  -n link-services

kubectl create secret generic postgres-backup-secret \
  --from-literal=postgres-user="linkuser" \
  --from-literal=postgres-password="$POSTGRES_PASSWORD" \
  --from-literal=s3-bucket="YOUR_S3_BUCKET" \
  --from-literal=encryption-key="$ENCRYPTION_KEY" \
  --from-literal=aws-access-key-id="YOUR_AWS_KEY" \
  --from-literal=aws-secret-access-key="YOUR_AWS_SECRET" \
  -n link-services

kubectl create secret generic redis-secret \
  --from-literal=password="$REDIS_PASSWORD" \
  --from-literal=sentinel-password="$(openssl rand -base64 32)" \
  -n link-services

kubectl create secret generic redis-backup-secret \
  --from-literal=redis-password="$REDIS_PASSWORD" \
  --from-literal=s3-bucket="YOUR_S3_BUCKET" \
  --from-literal=encryption-key="$ENCRYPTION_KEY" \
  --from-literal=aws-access-key-id="YOUR_AWS_KEY" \
  --from-literal=aws-secret-access-key="YOUR_AWS_SECRET" \
  -n link-services

kubectl create secret generic qdrant-backup-secret \
  --from-literal=s3-bucket="YOUR_S3_BUCKET" \
  --from-literal=aws-access-key-id="YOUR_AWS_KEY" \
  --from-literal=aws-secret-access-key="YOUR_AWS_SECRET" \
  -n link-services
```

### Step 3: Deploy S3 Infrastructure

```bash
# Navigate to Terraform module
cd terraform/modules/backup-storage

# Create variables file
cat > terraform.tfvars << EOF
environment = "production"
primary_bucket_name = "your-app-backups"
secondary_bucket_name = "your-app-backups-dr"
backup_user_arn = "arn:aws:iam::YOUR_ACCOUNT:user/backup-user"
EOF

# Initialize and deploy
terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### Step 4: Deploy Primary Database Services

```bash
# Deploy PostgreSQL with WAL archiving
kubectl apply -f k8s/postgres-primary-wal.yaml

# Deploy Redis HA cluster
kubectl apply -f k8s/redis-sentinel-ha.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=postgres-primary -n link-services --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis-master -n link-services --timeout=300s
```

### Step 5: Deploy Read Replicas

```bash
# Deploy PostgreSQL replicas
kubectl apply -f k8s/postgres-replica.yaml

# Wait for replicas to catch up
kubectl wait --for=condition=ready pod -l app=postgres-replica -n link-services --timeout=600s
```

### Step 6: Deploy Backup Services

```bash
# Deploy backup CronJobs
kubectl apply -f k8s/postgres-backup-cronjob.yaml
kubectl apply -f k8s/qdrant-backup-cronjob.yaml
```

### Step 7: Deploy Monitoring

```bash
# Deploy Prometheus alerts
kubectl apply -f monitoring/prometheus/rules/backup_alerts.yml

# Import Grafana dashboard (if Grafana is installed)
kubectl create configmap backup-dashboard \
  --from-file=monitoring/grafana/dashboards/backup-monitoring-dashboard.json \
  -n monitoring
```

## Verification and Testing

### Check Service Status

```bash
# Check all pods are running
kubectl get pods -n link-services

# Check persistent volumes
kubectl get pvc -n link-services

# Check services
kubectl get svc -n link-services
```

### Test Database Connections

```bash
# Test PostgreSQL primary
kubectl exec postgres-primary-0 -n link-services -- pg_isready -U linkuser -d linkdb

# Test PostgreSQL replica
kubectl exec postgres-replica-0 -n link-services -- pg_isready -U linkuser -d linkdb

# Test Redis master
kubectl exec redis-master-0 -n link-services -- redis-cli -a $REDIS_PASSWORD ping
```

### Test Backup System

```bash
# Run manual PostgreSQL backup test
kubectl create job --from=cronjob/postgres-backup postgres-backup-test-$(date +%Y%m%d) -n link-services

# Check backup job logs
kubectl logs job/postgres-backup-test-$(date +%Y%m%d) -n link-services

# Verify backup in S3
aws s3 ls s3://your-backup-bucket/postgres-backups/ --recursive
```

### Test Replication

```bash
# Check PostgreSQL replication status
kubectl exec postgres-primary-0 -n link-services -- psql -U linkuser -d linkdb -c "SELECT * FROM pg_stat_replication;"

# Check Redis replication
kubectl exec redis-master-0 -n link-services -- redis-cli -a $REDIS_PASSWORD INFO replication
```

## Troubleshooting Common Issues

### 1. Pods Stuck in Pending State

**Cause**: Missing storage classes or insufficient cluster resources

**Solution**:
```bash
# Check storage classes exist
kubectl get storageclass

# Check node resources
kubectl describe nodes

# Check pod events
kubectl describe pod <pod-name> -n link-services
```

### 2. Backup Jobs Failing with S3 Errors

**Cause**: Incorrect AWS credentials or S3 permissions

**Solution**:
```bash
# Test S3 access from cluster
kubectl run aws-test --rm -it --image=amazon/aws-cli -- aws s3 ls s3://your-bucket/

# Check secret values
kubectl get secret postgres-backup-secret -n link-services -o yaml
```

### 3. PostgreSQL Replicas Not Connecting

**Cause**: Incorrect replication credentials or network issues

**Solution**:
```bash
# Check replication user exists
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "\du"

# Check pg_hba.conf allows replication
kubectl exec postgres-primary-0 -n link-services -- cat /var/lib/postgresql/data/pg_hba.conf
```

### 4. Redis Sentinel Not Working

**Cause**: Incorrect Redis passwords or Sentinel configuration

**Solution**:
```bash
# Check Sentinel status
kubectl exec redis-sentinel-0 -n link-services -- redis-cli -p 26379 -a $SENTINEL_PASSWORD SENTINEL masters

# Check Redis master status
kubectl exec redis-master-0 -n link-services -- redis-cli -a $REDIS_PASSWORD INFO server
```

## Monitoring and Maintenance

### Daily Checks

```bash
# Check backup job status
kubectl get jobs -n link-services -l component=backup

# Check service health
kubectl get pods -n link-services

# Check storage usage
kubectl get pvc -n link-services
```

### Weekly Checks

```bash
# Test backup restoration (in test environment)
# Verify cross-region replication
aws s3 ls s3://your-backup-bucket-dr/

# Check monitoring alerts
kubectl get prometheusrules -n monitoring
```

### Monthly Tasks

- Review backup retention policies
- Test disaster recovery procedures  
- Update DR documentation
- Check storage costs and optimize

## Security Considerations

### Credential Management
- Rotate passwords quarterly
- Use AWS IAM roles when possible
- Enable audit logging for all services

### Network Security  
- Ensure network policies are applied
- Use TLS for all connections
- Restrict backup job network access

### Data Encryption
- Verify backup encryption is working
- Test decryption procedures
- Secure encryption key storage

## Cost Optimization

### Storage Optimization
- Review S3 lifecycle policies quarterly
- Monitor cross-region transfer costs
- Consider compression for large backups

### Compute Optimization
- Right-size replica instances
- Use spot instances for testing
- Schedule backups during low-cost hours

---

## Support and Documentation

- **Runbooks**: [docs/disaster-recovery/runbooks/](../disaster-recovery/runbooks/)
- **Monitoring**: [Grafana Dashboard](https://grafana.yourcompany.com/d/backup-overview)
- **Alerts**: [Prometheus Rules](../../monitoring/prometheus/rules/backup_alerts.yml)

For issues or questions, contact the DevOps team or create an incident via PagerDuty.

---

*Last Updated*: $(date)  
*Next Review*: $(date -d '+3 months')  
*Owner*: DevOps Team