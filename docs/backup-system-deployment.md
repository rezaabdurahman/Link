# Backup System Automated Deployment Guide

## Overview

This document describes the fully automated backup and disaster recovery system for the Link application. The system is designed to deploy via CI/CD with zero manual intervention, using GitHub Actions, Helm charts, and ArgoCD for GitOps.

## Architecture

### Components
- **Helm Chart**: `k8s/helm/backup-system/` - Templated Kubernetes resources
- **GitHub Actions**: `.github/workflows/backup-infrastructure.yml` - CI/CD pipeline
- **ArgoCD Applications**: `k8s/argocd/backup-system-app.yaml` - GitOps deployment
- **Terraform Module**: `terraform/modules/backup-storage/` - AWS infrastructure
- **External Secrets**: Automatic credential management from AWS Secrets Manager

### Backup Services
1. **PostgreSQL Backups**: Daily encrypted backups with Point-in-Time Recovery (PITR)
2. **Redis Backups**: AOF persistence with 6-hour backup schedule
3. **Qdrant Backups**: Vector database collection snapshots
4. **WAL Archiving**: Continuous PostgreSQL WAL archiving for PITR

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

The backup system deploys automatically via GitHub Actions when changes are pushed to the repository.

#### Triggers
- Push to `main` or `develop` branches affecting backup-related files
- Manual workflow dispatch with environment selection
- Scheduled runs for drift detection (Mondays at 6 AM UTC)

#### Workflow Stages
1. **Validation**: Helm chart linting and template validation
2. **Infrastructure**: Terraform deployment of S3 buckets and AWS resources
3. **Application**: Helm deployment of backup system to Kubernetes
4. **Verification**: Health checks and backup validation tests

#### Required GitHub Secrets
```yaml
AWS_ACCESS_KEY_ID: <AWS access key for Terraform>
AWS_SECRET_ACCESS_KEY: <AWS secret key for Terraform>
TF_STATE_BUCKET: <S3 bucket for Terraform state>
BACKUP_USER_ARN: <ARN of backup IAM user>
KUBECONFIG: <Base64 encoded kubeconfig>
SLACK_WEBHOOK_URL: <Slack notifications webhook>
GITHUB_TOKEN: <GitHub token for creating issues>
```

### Method 2: ArgoCD GitOps

For environments using ArgoCD, the backup system can be deployed via GitOps.

#### Prerequisites
1. ArgoCD installed and configured
2. External Secrets Operator installed
3. AWS credentials configured in ArgoCD

#### Deployment
```bash
# Apply ArgoCD application
kubectl apply -f k8s/argocd/backup-system-app.yaml

# ArgoCD will automatically sync and deploy the backup system
```

### Method 3: Manual Helm Deployment

For development or troubleshooting, manual deployment is supported.

#### Prerequisites
```bash
# Install required tools
helm version  # 3.14.0+
kubectl version  # 1.28.0+

# Create namespace
kubectl create namespace link-services

# Install External Secrets Operator (if not installed)
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets-system --create-namespace
```

#### Manual Deployment Steps
```bash
# 1. Deploy AWS infrastructure with Terraform
cd terraform/modules/backup-storage
terraform init
terraform plan -var="environment=staging" -var="primary_bucket_name=link-backups-staging"
terraform apply

# 2. Configure secrets in AWS Secrets Manager
aws secretsmanager create-secret --name "backup/postgres/credentials" --secret-string '{"username":"postgres","password":"your-password"}'

# 3. Deploy backup system with Helm
cd k8s/helm/backup-system
helm install backup-system . -f values-staging.yaml -n link-services
```

## Environment Configuration

### Development
- **Schedule**: Daily backups only
- **Retention**: 3 successful, 1 failed job
- **Features**: Encryption disabled, minimal monitoring
- **File**: `k8s/helm/backup-system/values-development.yaml`

### Staging
- **Schedule**: Twice daily for PostgreSQL, every 8 hours for others
- **Retention**: 14 successful, 3 failed jobs
- **Features**: Cross-region replication, basic monitoring
- **File**: `k8s/helm/backup-system/values-staging.yaml`

### Production
- **Schedule**: Every 2 hours for PostgreSQL, every 6 hours for others
- **Retention**: 30 successful, 5 failed jobs
- **Features**: Full encryption, comprehensive monitoring, alerting
- **File**: `k8s/helm/backup-system/values-production.yaml`

## Security and Credentials

### External Secrets Integration
The system uses External Secrets Operator to automatically sync credentials from AWS Secrets Manager:

```yaml
# Credentials are stored in AWS Secrets Manager:
backup/postgres/credentials: Database credentials
backup/redis/credentials: Redis credentials  
backup/qdrant/credentials: Qdrant API credentials
backup/aws/backup-user-credentials: AWS IAM credentials
backup/s3/config: S3 bucket configuration
backup/encryption/master-key: Backup encryption key
```

### Encryption
- **Transport**: All data encrypted in transit using TLS
- **Storage**: S3 server-side encryption (AES-256)
- **Application**: AES-256-GCM encryption for backup files
- **Key Management**: Master key stored in AWS Secrets Manager

## Monitoring and Alerting

### Prometheus Metrics
- `backup_job_duration_seconds`: Backup job execution time
- `backup_job_success`: Success/failure status
- `backup_size_bytes`: Size of backup files
- `backup_age_seconds`: Age of last successful backup

### Grafana Dashboard
- Real-time backup status
- Historical backup trends
- Storage usage tracking
- Alert status overview

### Alerts
- **Backup Failures**: Alert after 2 consecutive failures
- **Storage Usage**: Alert at 85% capacity
- **Replication Lag**: Alert if replication delay > 1 hour
- **Job Duration**: Alert if backup takes longer than expected

## Disaster Recovery

### Recovery Time Objectives (RTO/RPO)
- **RTO**: 4 hours for full system recovery
- **RPO**: 1 hour maximum data loss
- **PITR**: Point-in-time recovery available for last 7 days

### Recovery Procedures

#### PostgreSQL Recovery
```bash
# 1. Restore from latest backup
kubectl create job postgres-restore --from=configmap/restore-scripts

# 2. Point-in-time recovery
kubectl exec -it postgres-primary-0 -- pg_basebackup -h backup-restore-host -D /tmp/restore
kubectl exec -it postgres-primary-0 -- pg_ctl start -D /tmp/restore -o "-p 5433"
```

#### Redis Recovery
```bash
# Restore Redis from backup
kubectl create job redis-restore --from=configmap/redis-restore-scripts
```

#### Cross-Region Failover
```bash
# Switch to secondary region
kubectl patch service postgres-primary -p '{"spec":{"externalName":"postgres-secondary.us-east-1.rds.amazonaws.com"}}'
```

## Troubleshooting

### Common Issues

#### 1. Backup Job Failures
```bash
# Check job logs
kubectl logs job/postgres-backup-<timestamp> -n link-services

# Common causes:
# - S3 credentials expired
# - Database connection issues
# - Insufficient storage space
```

#### 2. External Secrets Not Syncing
```bash
# Check external secret status
kubectl get externalsecrets -n link-services
kubectl describe externalsecret postgres-backup-secret -n link-services

# Verify AWS credentials
kubectl get secret backup-system-aws-creds -n link-services -o yaml
```

#### 3. GitHub Actions Failures
```bash
# Check workflow logs in GitHub Actions tab
# Common issues:
# - AWS credentials misconfigured
# - Kubernetes context not accessible
# - Terraform state lock conflicts
```

### Debugging Commands

```bash
# View all backup-related resources
kubectl get all -l app.kubernetes.io/name=backup-system -n link-services

# Check CronJob schedules
kubectl get cronjobs -n link-services

# View recent backup jobs
kubectl get jobs -l app.kubernetes.io/component=postgres-backup -n link-services --sort-by=.metadata.creationTimestamp

# Check S3 bucket contents
aws s3 ls s3://link-app-backups-staging/postgres-backups/

# Verify backup file integrity
aws s3 cp s3://link-app-backups-staging/postgres-backups/latest/backup.sql.enc /tmp/
openssl enc -d -aes-256-cbc -in /tmp/backup.sql.enc -out /tmp/backup.sql -k "$ENCRYPTION_KEY"
```

## Cost Optimization

### S3 Lifecycle Policies
- **Standard → Standard-IA**: 30 days
- **Standard-IA → Glacier**: 90 days
- **Glacier → Deep Archive**: 365 days
- **Expiration**: 7 years (compliance requirement)

### Resource Optimization
- CronJobs use minimal resource requests
- Backup containers automatically terminate after completion
- Cross-region replication uses Standard-IA storage class

### Cost Monitoring
- CloudWatch metrics track storage usage
- Monthly cost alerts configured
- Lifecycle transitions optimize long-term costs

## Compliance and Audit

### Data Retention
- **PostgreSQL**: 7 years retention for compliance
- **Redis**: 3 years retention
- **WAL Files**: 1 year retention
- **Audit Logs**: 90 days in CloudTrail

### Access Control
- Backup operations use dedicated IAM user
- Least privilege access principles
- All S3 access logged via CloudTrail
- Network policies restrict pod-to-pod communication

### Compliance Features
- Data encrypted at rest and in transit
- Backup integrity verification
- Audit trail of all backup operations
- Disaster recovery testing documented

## Maintenance

### Regular Tasks
- Monthly review of backup success rates
- Quarterly disaster recovery testing
- Annual security review of credentials
- Cost optimization review

### Updates
- Backup system images updated automatically via Dependabot
- Helm chart versioned and tested before deployment
- Terraform modules follow semantic versioning

This completes the comprehensive backup system deployment guide. The system is designed to be fully automated, secure, and compliant with enterprise requirements.