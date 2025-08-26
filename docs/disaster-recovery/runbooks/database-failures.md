# Database Failures Response

**Severity**: SEV-1 or SEV-2 (depending on impact)  
**Response Time**: < 15-30 minutes  
**Estimated Resolution Time**: 30 minutes - 4 hours

## 📋 Overview

This runbook covers PostgreSQL database failures including connection issues, replication problems, data corruption, and performance degradation in the Link application.

## 🎯 Quick Reference

| Issue Type | Severity | Response Time | Common Causes |
|------------|----------|---------------|---------------|
| Complete DB unavailable | SEV-1 | < 15 min | Pod failure, disk full, corruption |
| Replication lag | SEV-2 | < 30 min | Network issues, load imbalance |
| Connection exhaustion | SEV-2 | < 30 min | Connection pool misconfiguration |
| Slow queries | SEV-3 | < 2 hours | Missing indexes, large datasets |

## 🚨 Immediate Assessment (0-10 minutes)

### 1. Quick Database Health Check

```bash
# Check if database pods are running
kubectl get pods -l app=postgres -n link-services -o wide

# Test database connectivity
kubectl exec postgres-primary-0 -n link-services -- pg_isready -U postgres

# Check basic database functionality
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT version();"
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT NOW();"
```

### 2. Application Impact Assessment

```bash
# Check which services are affected
services=("api-gateway" "user-svc" "chat-svc" "discovery-svc" "search-svc" "ai-svc")

for service in "${services[@]}"; do
  echo "=== Checking $service database connections ==="
  kubectl logs deployment/$service -n link-services --tail=20 --since=10m | grep -i -E "(database|postgres|connection.*error|timeout)"
done

# Check current connection count vs limits
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
  SELECT 
    count(*) as current_connections,
    setting as max_connections,
    round(100.0 * count(*) / setting::int, 2) as percent_used
  FROM pg_stat_activity 
  CROSS JOIN pg_settings 
  WHERE name = 'max_connections'
  GROUP BY setting;"
```

### 3. Storage and Resource Check

```bash
# Check disk space
kubectl exec postgres-primary-0 -n link-services -- df -h

# Check memory usage
kubectl top pod postgres-primary-0 -n link-services
kubectl exec postgres-primary-0 -n link-services -- free -h

# Check persistent volume status
kubectl get pv | grep postgres
kubectl describe pv postgres-primary-pv
```

## 🔍 Detailed Diagnosis

### Database Pod Issues

```bash
# Detailed pod status
kubectl describe pod postgres-primary-0 -n link-services
kubectl describe pod postgres-replica-0 -n link-services

# Check recent events
kubectl get events --sort-by=.metadata.creationTimestamp -n link-services | grep postgres | tail -20

# Check pod logs for errors
kubectl logs postgres-primary-0 -n link-services --tail=100 --since=1h | grep -E "(ERROR|FATAL|PANIC)"
kubectl logs postgres-primary-0 -n link-services --previous --tail=100 | grep -E "(ERROR|FATAL|PANIC)"

# Check resource limits and requests
kubectl describe pod postgres-primary-0 -n link-services | grep -A 10 -B 5 -E "(Limits|Requests)"
```

### Database Internal Health

```bash
# Connection analysis
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  client_addr,
  usename,
  datname,
  state,
  count(*) as conn_count
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY client_addr, usename, datname, state
ORDER BY conn_count DESC;"

# Lock analysis
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS current_statement_in_blocking_process,
  blocked_activity.application_name AS blocked_application,
  blocking_activity.application_name AS blocking_application
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;"

# Replication status (if applicable)
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  client_addr,
  state,
  sync_state,
  replay_lag,
  write_lag,
  flush_lag
FROM pg_stat_replication;"
```

### Performance Analysis

```bash
# Slow query analysis
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Database size analysis
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  datname,
  pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database 
ORDER BY pg_database_size(datname) DESC;"

# Table and index usage
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables 
ORDER BY seq_tup_read DESC 
LIMIT 10;"
```

## 🛠 Common Resolution Scenarios

### Scenario 1: Database Pod Crashed or Won't Start

```bash
# Check why pod failed
kubectl describe pod postgres-primary-0 -n link-services
kubectl logs postgres-primary-0 -n link-services --previous

# Check persistent volume
kubectl get pvc postgres-primary-pvc -n link-services
kubectl describe pvc postgres-primary-pvc -n link-services

# If pod is in CrashLoopBackOff, check startup logs
kubectl logs postgres-primary-0 -n link-services --tail=50

# Common fixes:
# 1. Restart pod if it's a transient issue
kubectl delete pod postgres-primary-0 -n link-services

# 2. Check for disk space issues
kubectl exec postgres-primary-0 -n link-services -- du -sh /var/lib/postgresql/data/*
kubectl exec postgres-primary-0 -n link-services -- find /var/lib/postgresql/data -name "*.log" -mtime +7 -delete

# 3. If persistent volume is corrupted, restore from backup
./scripts/restore-postgres-from-backup.sh latest

# 4. Check for resource constraints
kubectl describe node $(kubectl get pod postgres-primary-0 -n link-services -o jsonpath='{.spec.nodeName}')
```

### Scenario 2: Connection Pool Exhaustion

```bash
# Check current connections
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT count(*), state 
FROM pg_stat_activity 
GROUP BY state;"

# Identify connection sources
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  client_addr,
  usename,
  application_name,
  count(*) as connections
FROM pg_stat_activity 
WHERE state = 'active'
GROUP BY client_addr, usename, application_name
ORDER BY connections DESC;"

# Kill idle connections if necessary (emergency only)
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' 
  AND query_start < NOW() - INTERVAL '30 minutes'
  AND query != '<IDLE>';"

# Restart application services to reset connection pools
kubectl rollout restart deployment api-gateway -n link-services
kubectl rollout restart deployment user-svc -n link-services

# Update connection pool settings if needed
kubectl patch configmap postgres-config -n link-services --patch='{"data":{"max_connections":"200"}}'
kubectl rollout restart statefulset postgres-primary -n link-services
```

### Scenario 3: Replication Lag Issues

```bash
# Check replication lag
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  client_addr,
  state,
  sync_state,
  CASE 
    WHEN replay_lag IS NULL THEN 'N/A'
    ELSE replay_lag::text
  END as replay_lag,
  CASE 
    WHEN write_lag IS NULL THEN 'N/A' 
    ELSE write_lag::text
  END as write_lag
FROM pg_stat_replication;"

# Check replica status
kubectl exec postgres-replica-0 -n link-services -- psql -U postgres -c "
SELECT 
  pg_is_in_recovery(),
  pg_last_wal_receive_lsn(),
  pg_last_wal_replay_lsn(),
  pg_last_xact_replay_timestamp();"

# Check network connectivity between primary and replica
kubectl exec postgres-primary-0 -n link-services -- ping -c 3 postgres-replica-0.postgres-replica.link-services.svc.cluster.local

# If replication is broken, reinitialize replica
kubectl delete pod postgres-replica-0 -n link-services
# Wait for pod to restart and sync

# Check WAL archiving if configured
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  archived_count,
  failed_count,
  last_archived_wal,
  last_archived_time
FROM pg_stat_archiver;"
```

### Scenario 4: Database Performance Issues

```bash
# Identify slow queries currently running
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
  AND state = 'active'
ORDER BY duration DESC;"

# Kill long-running queries if necessary (be careful!)
# kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT pg_cancel_backend(PID);"

# Check for missing indexes
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY n_distinct DESC;"

# Run VACUUM and ANALYZE if needed
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "VACUUM ANALYZE;"

# Check for table bloat
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
SELECT 
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname='public' 
  AND tablename IN ('users', 'conversations', 'messages')
ORDER BY abs(correlation) DESC;"
```

### Scenario 5: Disk Space Issues

```bash
# Check disk usage breakdown
kubectl exec postgres-primary-0 -n link-services -- df -h
kubectl exec postgres-primary-0 -n link-services -- du -sh /var/lib/postgresql/data/*

# Clean up old WAL files if safe to do so
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT pg_switch_wal();"
kubectl exec postgres-primary-0 -n link-services -- find /var/lib/postgresql/data/pg_wal -name "*.ready" -mmin +60 -delete

# Clean old log files
kubectl exec postgres-primary-0 -n link-services -- find /var/lib/postgresql/data/log -name "*.log" -mtime +7 -delete

# If critically low on space, temporarily increase PV size
kubectl patch pvc postgres-primary-pvc -n link-services -p '{"spec":{"resources":{"requests":{"storage":"150Gi"}}}}'

# Vacuum full on large tables during maintenance window
# kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "VACUUM FULL messages;"
```

## 🔄 Database Recovery Procedures

### From Automated Backups

```bash
# List available backups
aws s3 ls s3://link-backups/postgres-backups/ --recursive | sort

# Download latest backup
latest_backup=$(aws s3 ls s3://link-backups/postgres-backups/ --recursive | sort | tail -1 | awk '{print $4}')
aws s3 cp "s3://link-backups/$latest_backup" ./latest-backup.sql.enc

# Decrypt and restore (adjust encryption method as needed)
gpg --decrypt latest-backup.sql.enc > latest-backup.sql

# Stop applications to prevent writes during restore
kubectl scale deployment api-gateway --replicas=0 -n link-services
kubectl scale deployment user-svc --replicas=0 -n link-services
kubectl scale deployment chat-svc --replicas=0 -n link-services

# Restore database
kubectl exec -i postgres-primary-0 -n link-services -- psql -U postgres < latest-backup.sql

# Verify restoration
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "SELECT count(*) FROM users;"
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "SELECT MAX(created_at) FROM messages;"

# Restart applications
kubectl scale deployment api-gateway --replicas=3 -n link-services
kubectl scale deployment user-svc --replicas=2 -n link-services  
kubectl scale deployment chat-svc --replicas=2 -n link-services
```

### Point-in-Time Recovery (PITR)

```bash
# If you have WAL archiving enabled and need to recover to specific time
target_time="2024-01-01 12:00:00 UTC"

# Stop database
kubectl scale statefulset postgres-primary --replicas=0 -n link-services

# Restore base backup and configure recovery
kubectl exec postgres-primary-0 -n link-services -- bash -c "
echo \"recovery_target_time = '$target_time'\" > /var/lib/postgresql/data/recovery.conf
echo \"recovery_target_action = 'promote'\" >> /var/lib/postgresql/data/recovery.conf
"

# Start database in recovery mode
kubectl scale statefulset postgres-primary --replicas=1 -n link-services

# Monitor recovery progress
kubectl logs postgres-primary-0 -n link-services -f | grep -i recovery
```

## 📊 Monitoring and Validation

### Post-Recovery Health Checks

```bash
# Database connectivity
kubectl exec postgres-primary-0 -n link-services -- pg_isready -U postgres

# Replication status (if applicable)
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# Connection counts back to normal
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT count(*), state 
FROM pg_stat_activity 
GROUP BY state;"

# Performance metrics
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  datname,
  numbackends,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit,
  tup_returned,
  tup_fetched,
  tup_inserted,
  tup_updated,
  tup_deleted
FROM pg_stat_database 
WHERE datname IN ('link_users', 'link_chat', 'link_discovery');"

# Run application health checks
curl -f https://api.link-app.com/health
kubectl exec api-gateway-0 -n link-services -- /app/scripts/db-connectivity-test.sh
```

### Ongoing Monitoring Setup

```bash
# Set up enhanced monitoring for next 4 hours
kubectl apply -f - << EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: post-db-incident-monitoring
  namespace: monitoring
spec:
  groups:
  - name: database-post-incident
    rules:
    - alert: DatabaseConnectionSpike
      expr: pg_stat_database_numbackends > 150
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High database connection count post-incident"
    
    - alert: DatabaseSlowQueries
      expr: rate(postgres_slow_queries_total[5m]) > 10
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Increased slow queries detected post-incident"
        
    - alert: ReplicationLagHigh
      expr: pg_replication_lag_seconds > 60
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High replication lag detected"
EOF
```

## 🔧 Prevention and Improvements

### Common Database Issues Prevention

1. **Connection Pool Management**
   ```yaml
   # Update application config
   database:
     pool_size: 10
     max_overflow: 20
     pool_timeout: 30
     pool_recycle: 3600
   ```

2. **Query Performance Monitoring**
   ```sql
   -- Enable pg_stat_statements
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   
   -- Set up monitoring queries
   SELECT query, calls, total_time, mean_time 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

3. **Regular Maintenance**
   ```bash
   # Schedule regular VACUUM and ANALYZE
   kubectl create cronjob postgres-maintenance \
     --image=postgres:13 \
     --schedule="0 2 * * 0" \
     -- psql -h postgres-primary -U postgres -d link_users -c "VACUUM ANALYZE;"
   ```

4. **Enhanced Backup Strategy**
   ```bash
   # Implement continuous WAL archiving
   # Set up cross-region backup replication
   # Test backup restoration monthly
   ```

## 📝 Incident Documentation Template

```markdown
## Database Incident Summary
- **Incident Start**: [timestamp]
- **Detection Method**: [monitoring alert / user report]
- **Root Cause**: [specific database issue]
- **Resolution**: [actions taken]
- **Resolution Time**: [duration]
- **Data Loss**: [yes/no and scope]

## Technical Details
- **Affected Databases**: [list]
- **Error Messages**: [specific errors seen]
- **Recovery Method**: [backup restore / restart / etc]

## Impact Assessment
- **Services Affected**: [list of services]
- **User Impact**: [description and scope]
- **Duration**: [total downtime]

## Follow-up Actions
- [ ] Update monitoring thresholds
- [ ] Review backup/recovery procedures  
- [ ] Implement additional safeguards
- [ ] Update runbook based on lessons learned
```

---

**Important**: Database operations can have significant impact. Always verify your actions and don't hesitate to escalate to database experts for complex issues.

**Last Updated**: $(date)  
**Next Review**: Post-incident analysis  
**Maintained By**: DevOps Team