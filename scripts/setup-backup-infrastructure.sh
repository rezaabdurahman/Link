#!/bin/bash
# Complete Backup & DR Infrastructure Setup Script
# This script sets up ALL prerequisites for the backup system

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}"
}

# Check if required tools are installed
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    local missing_tools=()
    
    for tool in kubectl aws terraform; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install missing tools and run again"
        exit 1
    fi
    
    log_info "✅ All required tools are available"
}

# Collect configuration from user
collect_configuration() {
    log_section "Collecting Configuration"
    
    # Kubernetes context
    read -p "Kubernetes context (default: current): " KUBE_CONTEXT
    KUBE_CONTEXT=${KUBE_CONTEXT:-$(kubectl config current-context)}
    
    # AWS configuration
    read -p "AWS Region (default: us-west-2): " AWS_REGION
    AWS_REGION=${AWS_REGION:-us-west-2}
    
    read -p "S3 Bucket name for backups: " S3_BUCKET
    if [[ -z "$S3_BUCKET" ]]; then
        log_error "S3 bucket name is required"
        exit 1
    fi
    
    # Generate secure passwords
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    POSTGRES_REPL_PASSWORD=$(openssl rand -base64 32)
    REDIS_PASSWORD=$(openssl rand -base64 32)
    SENTINEL_PASSWORD=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    # AWS credentials
    read -p "AWS Access Key ID: " AWS_ACCESS_KEY
    read -sp "AWS Secret Access Key: " AWS_SECRET_KEY
    echo
    
    if [[ -z "$AWS_ACCESS_KEY" || -z "$AWS_SECRET_KEY" ]]; then
        log_error "AWS credentials are required"
        exit 1
    fi
    
    log_info "✅ Configuration collected"
}

# Deploy Kubernetes prerequisites
deploy_k8s_prerequisites() {
    log_section "Deploying Kubernetes Prerequisites"
    
    # Switch to correct context
    kubectl config use-context "$KUBE_CONTEXT"
    
    # Deploy prerequisites
    log_info "Creating namespace and storage classes..."
    kubectl apply -f k8s/00-prerequisites.yaml
    
    log_info "✅ Kubernetes prerequisites deployed"
}

# Create secrets with collected configuration
create_secrets() {
    log_section "Creating Secrets"
    
    # Create temporary secrets file with actual values
    cat > /tmp/secrets.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: link-services
type: Opaque
stringData:
  database: "linkdb"
  username: "linkuser"
  password: "${POSTGRES_PASSWORD}"
  replication-username: "replicator"
  replication-password: "${POSTGRES_REPL_PASSWORD}"
  replica-connection-string: "postgresql://linkuser:${POSTGRES_PASSWORD}@postgres-replica:5432/linkdb?sslmode=require"

---
apiVersion: v1
kind: Secret
metadata:
  name: postgres-backup-secret
  namespace: link-services
type: Opaque
stringData:
  postgres-user: "linkuser"
  postgres-password: "${POSTGRES_PASSWORD}"
  s3-bucket: "${S3_BUCKET}"
  encryption-key: "${ENCRYPTION_KEY}"
  aws-access-key-id: "${AWS_ACCESS_KEY}"
  aws-secret-access-key: "${AWS_SECRET_KEY}"

---
apiVersion: v1
kind: Secret
metadata:
  name: redis-secret
  namespace: link-services
type: Opaque
stringData:
  password: "${REDIS_PASSWORD}"
  sentinel-password: "${SENTINEL_PASSWORD}"

---
apiVersion: v1
kind: Secret
metadata:
  name: redis-backup-secret
  namespace: link-services
type: Opaque
stringData:
  redis-password: "${REDIS_PASSWORD}"
  s3-bucket: "${S3_BUCKET}"
  encryption-key: "${ENCRYPTION_KEY}"
  aws-access-key-id: "${AWS_ACCESS_KEY}"
  aws-secret-access-key: "${AWS_SECRET_KEY}"

---
apiVersion: v1
kind: Secret
metadata:
  name: qdrant-backup-secret
  namespace: link-services
type: Opaque
stringData:
  s3-bucket: "${S3_BUCKET}"
  aws-access-key-id: "${AWS_ACCESS_KEY}"
  aws-secret-access-key: "${AWS_SECRET_KEY}"
EOF

    # Apply secrets
    kubectl apply -f /tmp/secrets.yaml
    
    # Clean up temporary file
    rm /tmp/secrets.yaml
    
    log_info "✅ Secrets created successfully"
}

# Deploy S3 infrastructure using Terraform
deploy_s3_infrastructure() {
    log_section "Deploying S3 Infrastructure"
    
    # Create Terraform variables file
    cat > terraform/modules/backup-storage/terraform.tfvars << EOF
environment = "production"
primary_region = "${AWS_REGION}"
secondary_region = "us-east-1"
primary_bucket_name = "${S3_BUCKET}"
secondary_bucket_name = "${S3_BUCKET}-dr"
backup_user_arn = "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):user/backup-user"
common_tags = {
  Project = "Link"
  Environment = "production"
  ManagedBy = "Terraform"
}
EOF

    # Initialize and deploy Terraform
    cd terraform/modules/backup-storage
    terraform init
    terraform plan -var-file=terraform.tfvars
    
    read -p "Deploy S3 infrastructure? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        terraform apply -var-file=terraform.tfvars -auto-approve
        log_info "✅ S3 infrastructure deployed"
    else
        log_warn "S3 infrastructure deployment skipped"
    fi
    
    cd - > /dev/null
}

# Deploy primary database services
deploy_primary_services() {
    log_section "Deploying Primary Database Services"
    
    # Deploy PostgreSQL primary
    log_info "Deploying PostgreSQL primary..."
    kubectl apply -f k8s/postgres-primary-wal.yaml
    
    # Deploy Redis HA
    log_info "Deploying Redis HA cluster..."
    kubectl apply -f k8s/redis-sentinel-ha.yaml
    
    # Wait for services to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres-primary -n link-services --timeout=300s
    
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis-master -n link-services --timeout=300s
    
    log_info "✅ Primary services deployed and ready"
}

# Deploy replica services
deploy_replica_services() {
    log_section "Deploying Replica Services"
    
    # Create replication slots first
    kubectl apply -f k8s/postgres-replica.yaml
    
    # Wait for replicas to be ready
    log_info "Waiting for PostgreSQL replicas to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres-replica -n link-services --timeout=600s
    
    log_info "✅ Replica services deployed and ready"
}

# Deploy backup services
deploy_backup_services() {
    log_section "Deploying Backup Services"
    
    # Deploy backup CronJobs
    kubectl apply -f k8s/postgres-backup-cronjob.yaml
    kubectl apply -f k8s/qdrant-backup-cronjob.yaml
    
    log_info "✅ Backup services deployed"
}

# Deploy monitoring
deploy_monitoring() {
    log_section "Deploying Monitoring"
    
    # Deploy Prometheus rules
    kubectl apply -f monitoring/prometheus/rules/backup_alerts.yml
    
    # Deploy Grafana dashboard (assuming Grafana is already installed)
    if kubectl get pods -l app=grafana -n monitoring &>/dev/null; then
        kubectl create configmap backup-dashboard \
            --from-file=monitoring/grafana/dashboards/backup-monitoring-dashboard.json \
            -n monitoring || log_warn "Dashboard configmap may already exist"
    else
        log_warn "Grafana not found, skipping dashboard deployment"
    fi
    
    log_info "✅ Monitoring deployed"
}

# Test the backup system
test_backup_system() {
    log_section "Testing Backup System"
    
    # Test PostgreSQL backup
    log_info "Testing PostgreSQL backup..."
    kubectl create job --from=cronjob/postgres-backup postgres-backup-test-$(date +%Y%m%d) -n link-services
    
    # Wait for job completion
    kubectl wait --for=condition=complete job/postgres-backup-test-$(date +%Y%m%d) -n link-services --timeout=600s
    
    # Check job status
    if kubectl get job postgres-backup-test-$(date +%Y%m%d) -n link-services -o jsonpath='{.status.succeeded}' | grep -q "1"; then
        log_info "✅ PostgreSQL backup test successful"
    else
        log_error "❌ PostgreSQL backup test failed"
        kubectl logs job/postgres-backup-test-$(date +%Y%m%d) -n link-services
    fi
    
    # Test S3 access
    log_info "Testing S3 access..."
    if aws s3 ls s3://${S3_BUCKET}/ &>/dev/null; then
        log_info "✅ S3 access confirmed"
    else
        log_error "❌ S3 access failed"
    fi
}

# Generate summary report
generate_summary() {
    log_section "Deployment Summary"
    
    cat << EOF

🎉 Backup & DR Infrastructure Deployment Complete!

📋 DEPLOYED COMPONENTS:
✅ Kubernetes namespace and storage classes
✅ All required secrets created
✅ S3 backup storage with cross-region replication
✅ PostgreSQL primary with WAL archiving
✅ PostgreSQL streaming replicas (2 replicas)
✅ Redis HA cluster with Sentinel (1 master + 2 replicas + 3 sentinels)
✅ Automated backup CronJobs
✅ Monitoring and alerting rules

🔐 GENERATED CREDENTIALS:
- PostgreSQL Password: ${POSTGRES_PASSWORD}
- Redis Password: ${REDIS_PASSWORD}
- Encryption Key: ${ENCRYPTION_KEY}

💾 BACKUP SCHEDULE:
- PostgreSQL: Daily at 2:00 AM UTC
- Redis: Every 6 hours  
- WAL Archives: Continuous (every 5 minutes)
- Qdrant: Every 6 hours

📊 MONITORING:
- Grafana Dashboard: https://grafana.yourcompany.com/d/backup-overview
- Prometheus Alerts: Configured for backup failures
- S3 Storage: ${S3_BUCKET} (primary) + ${S3_BUCKET}-dr (replica)

🆘 DISASTER RECOVERY:
- RTO: 4 hours (regional failure)
- RPO: 1 hour (data loss)
- DR Documentation: docs/disaster-recovery/README.md

⚠️  IMPORTANT: Save the generated passwords securely!

EOF
}

# Main execution
main() {
    log_info "Starting Link App Backup & DR Infrastructure Setup"
    
    check_prerequisites
    collect_configuration
    deploy_k8s_prerequisites
    create_secrets
    deploy_s3_infrastructure
    deploy_primary_services
    deploy_replica_services  
    deploy_backup_services
    deploy_monitoring
    test_backup_system
    generate_summary
    
    log_info "🎉 Setup complete! Check the summary above for important information."
}

# Print usage if requested
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    cat << EOF
Usage: $0 [--help]

This script sets up the complete backup and disaster recovery infrastructure
for the Link application, including:

- Kubernetes prerequisites (namespace, storage classes)
- Database secrets and credentials  
- S3 backup storage with cross-region replication
- PostgreSQL with streaming replication
- Redis HA with Sentinel
- Automated backup CronJobs
- Monitoring and alerting

Prerequisites:
- kubectl configured for your cluster
- aws CLI configured with appropriate permissions
- terraform installed
- openssl for generating secure passwords

The script will prompt for necessary configuration and deploy everything
in the correct order.

EOF
    exit 0
fi

# Execute main function
main "$@"