# PostgreSQL High Availability Migration Guide
## CloudNativePG Implementation with Leader Election

This guide covers the migration from single PostgreSQL instance to a high availability cluster using CloudNativePG with automatic leader election and failover.

## 🎯 Migration Overview

**From:** Single PostgreSQL 13 instance
**To:** CloudNativePG 3-node PostgreSQL 16 cluster with leader election
**Downtime:** <1 minute during final cutover
**Benefits:** 
- Automatic leader election via Raft consensus
- Sub-30-second failover
- Continuous WAL archiving to S3
- Zero-downtime maintenance

## 📋 Prerequisites

### Infrastructure Requirements
- Kubernetes cluster with 3+ worker nodes
- Fast SSD storage class (gp3 with 3000 IOPS)
- S3 bucket for backups: `link-app-backups-production`
- Network connectivity between all nodes

### Access Requirements
- kubectl access to `link-services` and `cnpg-system` namespaces
- AWS S3 access for backup configuration
- Prometheus/Grafana access for monitoring

### Pre-Migration Checklist
```bash
# Verify cluster resources
kubectl get nodes -l node.kubernetes.io/instance-type=m6i.xlarge
kubectl get storageclass fast-ssd
kubectl get namespace link-services cnpg-system

# Verify S3 bucket access
aws s3 ls s3://link-app-backups-production/

# Check current PostgreSQL status
kubectl get pods -n link-services -l app=postgres
```

## 🚀 Migration Steps

### Phase 1: Deploy CloudNativePG Operator (15 minutes)

1. **Install the operator:**
```bash
kubectl apply -f k8s/cloudnative-pg/00-operator-install.yaml
```

2. **Verify operator deployment:**
```bash
kubectl get pods -n cnpg-system
kubectl logs -n cnpg-system deployment/cnpg-controller-manager
```

3. **Validate webhook configuration:**
```bash
kubectl get validatingadmissionwebhooks cnpg-validating-webhook-configuration
kubectl get mutatingadmissionwebhooks cnpg-mutating-webhook-configuration
```

### Phase 2: Prepare Backup and Credentials (10 minutes)

1. **Update S3 backup credentials:**
```bash
# Edit the secret with actual AWS credentials
kubectl edit secret backup-credentials -n link-services
```

2. **Update service database passwords:**
```bash
# Generate secure passwords for each service
kubectl edit secret postgres-cluster-credentials -n link-services
```

3. **Test S3 connectivity:**
```bash
kubectl run aws-cli-test --rm -it --image=amazon/aws-cli:latest -- aws s3 ls s3://link-app-backups-production/
```

### Phase 3: Deploy PostgreSQL Cluster with Integrated Backups (25 minutes)

1. **Deploy backup credentials first:**
```bash
kubectl apply -f k8s/cloudnative-pg/02-backup-configuration.yaml
```

2. **Deploy the cluster (includes integrated S3 backup):**
```bash
kubectl apply -f k8s/cloudnative-pg/01-postgres-cluster.yaml
```

3. **Monitor cluster bootstrap:**
```bash
# Watch cluster initialization
kubectl get cluster postgres-cluster -n link-services -w

# Check pod status
kubectl get pods -n link-services -l postgresql.cnpg.io/cluster=postgres-cluster

# Verify primary election
kubectl get cluster postgres-cluster -n link-services -o jsonpath='{.status.currentPrimary}'
```

4. **Validate database creation:**
```bash
# Connect to primary and verify databases
kubectl exec -it postgres-cluster-1 -n link-services -- psql -U linkuser -d linkdb -c "\l"
```

### Phase 4: Configure Scheduled Backups (10 minutes)

1. **Apply scheduled backup jobs:**
```bash
# This applies the remaining ScheduledBackup resources
kubectl apply -f k8s/cloudnative-pg/02-backup-configuration.yaml --dry-run=client -o yaml | grep -A 50 ScheduledBackup | kubectl apply -f -
```

2. **Trigger initial backup:**
```bash
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Backup
metadata:
  name: initial-backup-$(date +%Y%m%d-%H%M%S)
  namespace: link-services
spec:
  cluster:
    name: postgres-cluster
  method: barmanObjectStore
EOF
```

3. **Monitor backup progress:**
```bash
kubectl get backup -n link-services -w
```

### Phase 5: Update Connection Configurations (10 minutes)

1. **Update PgBouncer configuration:**
```bash
kubectl apply -f k8s/pgbouncer-configmap.yaml
kubectl rollout restart deployment pgbouncer -n link-services
```

2. **Verify PgBouncer connectivity:**
```bash
kubectl exec -it deployment/pgbouncer -n link-services -- pgbouncer -V
kubectl logs deployment/pgbouncer -n link-services
```

### Phase 6: Data Migration (30 minutes)

⚠️ **This is the critical phase with potential downtime**

1. **Create final backup of old database:**
```bash
kubectl exec postgres-old -- pg_dump -U linkuser linkdb > /tmp/final-backup.sql
```

2. **Stop application services:**
```bash
kubectl scale deployment api-gateway --replicas=0 -n link-services
kubectl scale deployment user-svc --replicas=0 -n link-services
kubectl scale deployment chat-svc --replicas=0 -n link-services
kubectl scale deployment discovery-svc --replicas=0 -n link-services
kubectl scale deployment search-svc --replicas=0 -n link-services
```

3. **Import data to new cluster:**
```bash
kubectl cp /tmp/final-backup.sql postgres-cluster-1:/tmp/ -n link-services
kubectl exec -it postgres-cluster-1 -n link-services -- psql -U linkuser -d linkdb < /tmp/final-backup.sql
```

4. **Update Terraform database outputs:**
```bash
cd terraform/
terraform apply -auto-approve
```

5. **Restart services with new connections:**
```bash
kubectl scale deployment api-gateway --replicas=3 -n link-services
kubectl scale deployment user-svc --replicas=3 -n link-services
kubectl scale deployment chat-svc --replicas=3 -n link-services
kubectl scale deployment discovery-svc --replicas=2 -n link-services
kubectl scale deployment search-svc --replicas=2 -n link-services
```

### Phase 7: Deploy Monitoring (10 minutes)

1. **Deploy monitoring configuration:**
```bash
kubectl apply -f k8s/cloudnative-pg/03-monitoring.yaml
```

2. **Verify Prometheus targets:**
```bash
# Check Prometheus for new targets
curl http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | contains("postgres"))'
```

3. **Import Grafana dashboard:**
```bash
# Dashboard should auto-import via ConfigMap
kubectl get configmap postgres-ha-dashboard -n link-services
```

## ✅ Post-Migration Validation

### Functionality Tests

1. **Test leader election:**
```bash
# Kill current primary and verify failover
PRIMARY=$(kubectl get cluster postgres-cluster -n link-services -o jsonpath='{.status.currentPrimary}')
kubectl delete pod $PRIMARY -n link-services

# Wait 30 seconds and verify new primary
sleep 30
kubectl get cluster postgres-cluster -n link-services -o jsonpath='{.status.currentPrimary}'
```

2. **Test application connectivity:**
```bash
# Test each service database connection
for svc in user chat discovery search ai; do
  kubectl exec -it deployment/${svc}-svc -n link-services -- curl -f http://localhost:8080/health
done
```

3. **Test read/write operations:**
```bash
# Write to primary
kubectl exec -it postgres-cluster-rw -n link-services -- psql -U linkuser -d linkdb -c "CREATE TABLE migration_test (id SERIAL PRIMARY KEY, created_at TIMESTAMP DEFAULT NOW());"

# Read from replica
kubectl exec -it postgres-cluster-ro -n link-services -- psql -U linkuser -d linkdb -c "SELECT COUNT(*) FROM migration_test;"
```

### Performance Tests

1. **Connection pooling test:**
```bash
# Test PgBouncer pool utilization
kubectl exec -it deployment/pgbouncer -n link-services -- psql -h localhost -p 5432 -U pgbouncer_stats -d pgbouncer -c "SHOW POOLS;"
```

2. **Replication lag test:**
```bash
# Generate load and measure replication lag
kubectl exec -it postgres-cluster-1 -n link-services -- pgbench -c 10 -t 1000 -U linkuser linkdb
```

### Backup and Recovery Tests

1. **Test WAL archiving:**
```bash
# Check WAL files in S3
aws s3 ls s3://link-app-backups-production/postgresql-backups/postgres-cluster/wals/ --recursive | tail -10
```

2. **Test point-in-time recovery:**
```bash
# Create test cluster from backup
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres-recovery-test
  namespace: link-services
spec:
  instances: 1
  bootstrap:
    recovery:
      source: postgres-cluster-with-backup
      recoveryTargetTime: "$(date -u -d '1 hour ago' '+%Y-%m-%d %H:%M:%S')"
EOF
```

## 🔍 Monitoring and Alerting

### Key Metrics to Monitor

1. **Cluster Health:**
   - `cnpg_pg_replication_is_replica == 0` (primary count)
   - `up{job="postgres-cluster"}` (instance availability)
   - `cnpg_pg_stat_replication_flush_lag` (replication lag)

2. **Performance:**
   - `cnpg_pg_stat_database_numbackends` (connections)
   - `rate(cnpg_pg_xlog_position_bytes[5m])` (WAL generation)
   - `cnpg_pg_stat_database_tup_returned` (query performance)

3. **Backup Health:**
   - `cnpg_pg_backup_last_successful_timestamp` (last backup)
   - `cnpg_pg_stat_archiver_failed_count` (WAL archiving failures)

### Critical Alerts

- **PostgreSQLNoPrimary** - No primary instance (leader election failed)
- **PostgreSQLMultiplePrimaries** - Split-brain scenario
- **PostgreSQLReplicationLag** - High replication lag
- **PostgreSQLBackupFailed** - Backup hasn't succeeded in 24h

### Grafana Dashboards

Access the PostgreSQL HA dashboard at:
`http://grafana:3000/d/postgres-ha/postgresql-ha-cloudnativepg`

## 🚨 Troubleshooting

### Common Issues

1. **Operator not starting:**
```bash
kubectl describe pod -n cnpg-system
kubectl logs -n cnpg-system deployment/cnpg-controller-manager
```

2. **Cluster bootstrap failing:**
```bash
kubectl describe cluster postgres-cluster -n link-services
kubectl logs postgres-cluster-1 -n link-services
```

3. **Backup failures:**
```bash
kubectl describe backup -n link-services
kubectl logs postgres-cluster-1 -n link-services | grep -i backup
```

4. **Failover not working:**
```bash
# Check cluster status
kubectl get cluster postgres-cluster -n link-services -o yaml

# Check events
kubectl get events -n link-services --sort-by='.lastTimestamp'
```

### Recovery Procedures

1. **Manual failover:**
```bash
kubectl patch cluster postgres-cluster -n link-services --type='merge' -p='{"spec":{"primaryUpdateStrategy":"supervised"}}'
kubectl delete pod postgres-cluster-1 -n link-services
```

2. **Restore from backup:**
```bash
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres-cluster-restored
  namespace: link-services
spec:
  instances: 3
  bootstrap:
    recovery:
      backup:
        name: postgres-cluster-daily-backup-YYYYMMDD
EOF
```

## 📞 Emergency Contacts

- **On-call Engineer:** [Your on-call system]
- **Database Team:** [Your database team contact]
- **CloudNativePG Support:** https://github.com/cloudnative-pg/cloudnative-pg/issues

## 📚 Additional Resources

- [CloudNativePG Documentation](https://cloudnative-pg.io/documentation/)
- [PostgreSQL High Availability Guide](https://www.postgresql.org/docs/current/high-availability.html)
- [Kubernetes Storage Best Practices](https://kubernetes.io/docs/concepts/storage/)
- [Link App Runbooks](https://runbooks.link-app.com/)

---

**Migration completed successfully! 🎉**

Your PostgreSQL setup now provides:
- ✅ Automatic leader election and failover
- ✅ Sub-30-second recovery time
- ✅ Continuous WAL archiving to S3
- ✅ Zero-downtime maintenance capability
- ✅ Comprehensive monitoring and alerting