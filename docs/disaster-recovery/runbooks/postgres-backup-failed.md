# PostgreSQL Backup Failed - Runbook

## Alert: PostgreSQLBackupFailed

**Severity**: Critical  
**Component**: PostgreSQL Backup  
**Dashboard**: [Backup Monitoring Dashboard](https://grafana.linkapp.com/d/backup-overview)

## Description

This alert fires when:
- PostgreSQL backup hasn't run successfully in the last 24 hours, OR
- PostgreSQL backup job has failed with errors

## Immediate Actions (< 5 minutes)

1. **Check Alert Details**
   ```bash
   # Check Prometheus for specific error details
   curl -s "http://prometheus:9090/api/v1/query?query=postgres_backup_errors_total" | jq .
   
   # Check last successful backup timestamp
   curl -s "http://prometheus:9090/api/v1/query?query=postgres_backup_last_success_timestamp" | jq .
   ```

2. **Check Backup Job Status**
   ```bash
   # List recent backup jobs
   kubectl get jobs -l app=postgres-backup --sort-by=.metadata.creationTimestamp
   
   # Check most recent job logs
   kubectl logs job/$(kubectl get jobs -l app=postgres-backup -o jsonpath='{.items[-1:].metadata.name}')
   ```

3. **Verify Database Health**
   ```bash
   # Check PostgreSQL status
   kubectl exec postgres-primary-0 -- pg_isready -U $POSTGRES_USER -d $POSTGRES_DB
   
   # Check disk space on database server
   kubectl exec postgres-primary-0 -- df -h /var/lib/postgresql/data
   ```

## Investigation Steps

### 1. Analyze Job Failure

**Check Job Status**:
```bash
# Get detailed job information
kubectl describe job postgres-backup-$(date +%Y%m%d)

# Check pod logs for errors
kubectl logs -l job-name=postgres-backup-$(date +%Y%m%d) --tail=100
```

**Common Error Patterns**:
- `connection refused`: Database connectivity issues
- `permission denied`: Authentication or authorization problems  
- `no space left on device`: Storage issues
- `timeout`: Network or performance issues
- `encryption failed`: Encryption key or process issues

### 2. Check S3 Bucket Access

**Verify S3 Connectivity**:
```bash
# Test S3 bucket access from backup job pod
kubectl run s3-test --rm -it --image=amazon/aws-cli -- aws s3 ls s3://link-backups/postgres-backups/

# Check IAM permissions
kubectl get secret postgres-backup-secret -o jsonpath='{.data.aws-access-key-id}' | base64 -d
```

### 3. Database Connectivity Test

**Test Connection from Backup Pod**:
```bash
# Run connectivity test
kubectl run pg-test --rm -it --image=postgres:16-alpine -- pg_isready -h postgres-primary.link-services.svc.cluster.local -U $POSTGRES_USER

# Test authentication
kubectl run pg-auth-test --rm -it --image=postgres:16-alpine -- psql -h postgres-primary.link-services.svc.cluster.local -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT version();"
```

## Resolution Steps

### Scenario 1: Database Connection Issues

**Symptoms**: `connection refused`, `timeout`, `host unreachable`

**Resolution**:
```bash
# Check PostgreSQL service status
kubectl get service postgres-primary -n link-services

# Verify PostgreSQL pods are running
kubectl get pods -l app=postgres-primary -n link-services

# Check PostgreSQL configuration
kubectl exec postgres-primary-0 -- cat /var/lib/postgresql/data/postgresql.conf | grep listen_addresses

# Restart PostgreSQL if needed (CAREFUL!)
kubectl rollout restart statefulset postgres-primary -n link-services
```

### Scenario 2: Authentication Failures

**Symptoms**: `authentication failed`, `permission denied`, `role does not exist`

**Resolution**:
```bash
# Check backup user credentials
kubectl get secret postgres-backup-secret -o jsonpath='{.data.postgres-user}' | base64 -d
kubectl get secret postgres-backup-secret -o jsonpath='{.data.postgres-password}' | base64 -d

# Verify backup user exists in database
kubectl exec postgres-primary-0 -- psql -U postgres -c "\du+" | grep backup

# Create backup user if missing
kubectl exec postgres-primary-0 -- psql -U postgres -c "CREATE USER backup_user WITH PASSWORD 'secure_password';"
kubectl exec postgres-primary-0 -- psql -U postgres -c "GRANT CONNECT ON DATABASE link_users TO backup_user;"
kubectl exec postgres-primary-0 -- psql -U postgres -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;"
```

### Scenario 3: Storage Issues

**Symptoms**: `no space left on device`, `disk full`

**Resolution**:
```bash
# Check disk usage on PostgreSQL pod
kubectl exec postgres-primary-0 -- df -h

# Check backup pod storage
kubectl describe pod -l job-name=postgres-backup-$(date +%Y%m%d)

# Clean up old backup files if needed
kubectl exec postgres-primary-0 -- find /var/lib/postgresql/data -name "*.backup" -mtime +7 -delete

# Increase storage if needed
kubectl patch pvc postgres-data-postgres-primary-0 -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'
```

### Scenario 4: S3 Access Issues

**Symptoms**: `access denied`, `bucket does not exist`, `invalid credentials`

**Resolution**:
```bash
# Test S3 access with debug logging
kubectl run s3-debug --rm -it --image=amazon/aws-cli -- sh -c "
  export AWS_ACCESS_KEY_ID=$(kubectl get secret postgres-backup-secret -o jsonpath='{.data.aws-access-key-id}' | base64 -d)
  export AWS_SECRET_ACCESS_KEY=$(kubectl get secret postgres-backup-secret -o jsonpath='{.data.aws-secret-access-key}' | base64 -d)
  aws s3 ls s3://link-backups/ --debug
"

# Check S3 bucket policy
aws s3api get-bucket-policy --bucket link-backups

# Verify IAM user permissions
aws iam get-user-policy --user-name postgres-backup-user --policy-name postgres-backup-policy
```

### Scenario 5: Encryption Issues

**Symptoms**: `encryption failed`, `invalid key`, `openssl error`

**Resolution**:
```bash
# Check encryption key secret
kubectl get secret postgres-backup-secret -o jsonpath='{.data.encryption-key}' | base64 -d | wc -c

# Test encryption manually
kubectl run encryption-test --rm -it --image=postgres:16-alpine -- sh -c "
  echo 'test data' | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -k 'your-encryption-key' | openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 -k 'your-encryption-key'
"

# Rotate encryption key if needed (coordinate with security team)
kubectl create secret generic postgres-backup-secret-new \
  --from-literal=encryption-key="new-secure-key" \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Manual Backup Execution

If automated backup continues to fail, run manual backup:

```bash
# Create manual backup job
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: postgres-manual-backup-$(date +%Y%m%d-%H%M)
  namespace: link-services
spec:
  template:
    spec:
      containers:
      - name: manual-backup
        image: postgres:16-alpine
        command:
        - /bin/sh
        - -c
        - |
          set -euo pipefail
          BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
          DATABASES=("link_users" "link_chat" "link_ai" "link_discovery" "link_search")
          
          apk add --no-cache aws-cli openssl
          
          for DB in "\${DATABASES[@]}"; do
            echo "Manual backup of \$DB starting..."
            BACKUP_FILE="/tmp/manual-backup-\${BACKUP_DATE}-\${DB}.sql"
            
            pg_dump -h postgres-primary.link-services.svc.cluster.local \\
              -U \$POSTGRES_USER -d \$DB \\
              --no-password --verbose --clean --if-exists \\
              --format=custom --compress=6 -f "\$BACKUP_FILE"
            
            # Encrypt and upload
            openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \\
              -in "\$BACKUP_FILE" -out "\${BACKUP_FILE}.enc" \\
              -k "\$BACKUP_ENCRYPTION_KEY"
            
            aws s3 cp "\${BACKUP_FILE}.enc" \\
              "s3://\$BACKUP_S3_BUCKET/postgres-backups/manual/\$(basename \${BACKUP_FILE}.enc)" \\
              --storage-class STANDARD_IA
            
            echo "✅ Manual backup of \$DB completed"
          done
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-backup-secret
              key: postgres-user
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-backup-secret
              key: postgres-password
        - name: BACKUP_S3_BUCKET
          valueFrom:
            secretKeyRef:
              name: postgres-backup-secret
              key: s3-bucket
        - name: BACKUP_ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: postgres-backup-secret
              key: encryption-key
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: postgres-backup-secret
              key: aws-access-key-id
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: postgres-backup-secret
              key: aws-secret-access-key
      restartPolicy: OnFailure
EOF

# Monitor manual backup progress
kubectl logs -f job/postgres-manual-backup-$(date +%Y%m%d-%H%M)
```

## Verification Steps

After resolving the issue:

1. **Test Backup Functionality**:
   ```bash
   # Trigger a test backup
   kubectl create job --from=cronjob/postgres-backup postgres-backup-test-$(date +%Y%m%d)
   
   # Monitor progress
   kubectl logs -f job/postgres-backup-test-$(date +%Y%m%d)
   ```

2. **Verify S3 Upload**:
   ```bash
   # Check latest backup in S3
   aws s3 ls s3://link-backups/postgres-backups/ --recursive --human-readable | tail -5
   
   # Verify file integrity
   aws s3 cp s3://link-backups/postgres-backups/latest/metadata.json - | jq .
   ```

3. **Test Backup Restoration** (in test environment):
   ```bash
   # Download backup for testing
   aws s3 cp s3://link-backups/postgres-backups/postgres-backup-latest_link_users.sql.enc ./test-restore.enc
   
   # Test decryption
   openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 -k "$BACKUP_ENCRYPTION_KEY" \
     -in test-restore.enc -out test-restore.sql
   
   # Test restore (in test database)
   pg_restore -d test_database test-restore.sql
   ```

## Prevention Measures

1. **Monitor Disk Usage**:
   ```bash
   # Add disk usage alerts for PostgreSQL pods
   # Alert when disk usage > 80%
   ```

2. **Backup Validation**:
   ```bash
   # Add automated backup validation job
   # Run weekly restore tests in isolated environment
   ```

3. **Backup Redundancy**:
   ```bash
   # Ensure cross-region replication is working
   aws s3api get-bucket-replication --bucket link-backups
   ```

## Escalation

**If backup continues to fail after 2 hours**:
1. Escalate to Senior DevOps Engineer
2. Consider switching to standby backup method
3. Notify stakeholders about potential RPO impact

**Emergency Contacts**:
- Senior DevOps: [Phone/Slack]
- Database Administrator: [Phone/Slack]  
- On-call Manager: [Phone/PagerDuty]

## Related Runbooks

- [Database Recovery](./postgres-recovery.md)
- [S3 Access Issues](./s3-troubleshooting.md)
- [Point-in-Time Recovery](./postgres-pitr.md)
- [WAL Archiving Failed](./wal-archiving-failed.md)

---

**Last Updated**: $(date)  
**Next Review**: $(date -d '+3 months')  
**Owner**: DevOps Team