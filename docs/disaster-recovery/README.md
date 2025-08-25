# Link App Disaster Recovery Plan

## Overview

This document outlines the comprehensive disaster recovery (DR) plan for the Link social application, designed to ensure business continuity in the event of various failure scenarios.

## Recovery Objectives

- **Recovery Time Objective (RTO)**: 4 hours maximum
- **Recovery Point Objective (RPO)**: 1 hour maximum  
- **Availability Target**: 99.9% uptime
- **Data Retention**: 7 years (compliance requirement)

## Architecture Overview

### Primary Infrastructure
- **Region**: us-west-2 (Oregon)
- **Kubernetes**: EKS cluster with 3 availability zones
- **Database**: PostgreSQL with streaming replication
- **Cache**: Redis Cluster with AOF persistence
- **Vector DB**: Qdrant with automated backups
- **Storage**: S3 with cross-region replication

### Disaster Recovery Infrastructure  
- **Region**: us-east-1 (N. Virginia)
- **Backup Storage**: S3 with lifecycle policies
- **Network**: VPC peering for cross-region connectivity
- **DNS**: Route53 with health checks and failover

## Failure Scenarios and Response

### 1. Single Pod/Container Failure
**RTO**: < 5 minutes | **RPO**: 0 (no data loss)

**Detection**: 
- Kubernetes liveness/readiness probes
- Prometheus alerts

**Automatic Recovery**:
- Kubernetes automatically restarts failed pods
- Load balancer removes unhealthy instances

**Manual Steps**: None required

---

### 2. Node/EC2 Instance Failure  
**RTO**: < 10 minutes | **RPO**: 0 (no data loss)

**Detection**:
- Node status in Kubernetes
- CloudWatch EC2 instance health
- Prometheus node_exporter alerts

**Automatic Recovery**:
- Kubernetes reschedules pods to healthy nodes
- EKS auto-scaling group replaces failed instances

**Manual Steps**: 
1. Verify pod redistribution
2. Check application health
3. Scale if needed: `kubectl scale deployment <app> --replicas=X`

---

### 3. Availability Zone Failure
**RTO**: < 30 minutes | **RPO**: < 5 minutes

**Detection**:
- AWS Health Dashboard
- Prometheus multi-AZ monitoring
- Application health checks fail in specific AZ

**Automatic Recovery**:
- Load balancer stops routing to failed AZ
- Kubernetes schedules pods in healthy AZs
- EBS volumes available in other AZs

**Manual Steps**:
1. Verify traffic routing: `kubectl get ingress`
2. Check pod distribution: `kubectl get pods -o wide`
3. Scale applications if needed
4. Monitor database replication lag

---

### 4. Regional Failure
**RTO**: 4 hours | **RPO**: 1 hour

**Detection**:
- Complete loss of connectivity to us-west-2
- All health checks fail
- Cross-region monitoring alerts

**Manual Recovery Steps**:

#### Phase 1: Assessment (15 minutes)
1. **Confirm Regional Outage**
   ```bash
   # Check AWS status
   curl -s https://status.aws.amazon.com/
   
   # Test connectivity to primary region
   ping ec2.us-west-2.amazonaws.com
   
   # Check backup region health
   aws ec2 describe-instances --region us-east-1 --query 'Reservations[].Instances[].State.Name'
   ```

2. **Activate Incident Response**
   - Notify stakeholders via PagerDuty
   - Join incident bridge: `#incident-regional-failure`
   - Start incident timeline

#### Phase 2: Database Recovery (90 minutes)
1. **Restore PostgreSQL in DR Region**
   ```bash
   # Download latest backup from S3
   aws s3 cp s3://link-backups-us-east-1/postgres-backups/latest/ ./backups/ --recursive
   
   # Start PostgreSQL cluster in us-east-1
   kubectl apply -f k8s/postgres-primary-wal.yaml --context=us-east-1
   
   # Restore from backup
   kubectl exec postgres-primary-0 -- pg_restore -d link_users /backups/postgres-backup-latest_link_users.sql.enc
   ```

2. **Point-in-Time Recovery (if needed)**
   ```bash
   # Restore to specific timestamp
   kubectl exec postgres-primary-0 -- pg_pitr_restore.sh "2024-01-01 12:00:00 UTC"
   ```

#### Phase 3: Application Recovery (90 minutes)
1. **Deploy Core Services**
   ```bash
   # Switch kubectl context to DR region
   kubectl config use-context link-dr-us-east-1
   
   # Deploy applications
   helm upgrade --install link-app k8s/helm/link-app/ \
     --values k8s/helm/link-app/values-dr.yaml \
     --set image.tag=$(git rev-parse HEAD)
   ```

2. **Restore Redis Data**
   ```bash
   # Download Redis backup
   aws s3 cp s3://link-backups-us-east-1/redis-backups/latest/ ./redis-backup/
   
   # Restore Redis cluster
   kubectl exec redis-cluster-0 -- redis-cli --pipe < redis-backup/redis-restore-commands.txt
   ```

3. **Restore Qdrant Vector Data**
   ```bash
   # Download Qdrant backup
   aws s3 cp s3://link-backups-us-east-1/qdrant-backups/latest.tar.gz ./qdrant-backup.tar.gz
   
   # Restore collection
   ./scripts/restore-qdrant.sh qdrant-backup.tar.gz
   ```

#### Phase 4: Traffic Cutover (45 minutes)
1. **Update DNS Records**
   ```bash
   # Update Route53 to point to DR region
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z1234567890 \
     --change-batch file://dns-failover.json
   ```

2. **Verify Application Health**
   ```bash
   # Health check endpoints
   curl -f https://api.linkapp.com/health
   curl -f https://linkapp.com/
   
   # Check key functionality
   curl -X POST https://api.linkapp.com/v1/auth/login -d '{"email":"test@example.com","password":"test"}'
   ```

3. **Monitor and Scale**
   ```bash
   # Watch for increased load
   kubectl top pods
   kubectl top nodes
   
   # Scale if needed
   kubectl scale deployment api-gateway --replicas=10
   kubectl scale deployment user-svc --replicas=8
   ```

---

### 5. Database Corruption/Data Loss
**RTO**: 2 hours | **RPO**: Depends on backup frequency

**Detection**:
- Database integrity check failures
- Application errors indicating data inconsistency
- Backup verification failures

**Recovery Steps**:

1. **Stop Write Operations**
   ```bash
   # Scale down write services
   kubectl scale deployment user-svc --replicas=0
   kubectl scale deployment chat-svc --replicas=0
   
   # Enable read-only mode
   kubectl patch configmap postgres-config --patch '{"data":{"readonly":"true"}}'
   ```

2. **Assess Corruption Scope**
   ```bash
   # Check PostgreSQL logs
   kubectl logs postgres-primary-0 | grep -i "corrupt\|error"
   
   # Run integrity checks
   kubectl exec postgres-primary-0 -- vacuumdb --analyze-in-stages --all
   kubectl exec postgres-primary-0 -- pg_checksums --check
   ```

3. **Restore from Backup**
   ```bash
   # Find latest good backup
   aws s3 ls s3://link-backups/postgres-backups/ --recursive | tail -20
   
   # Restore database
   kubectl exec postgres-primary-0 -- pg_restore -c -d link_users /backups/postgres-backup-YYYYMMDD_HHMMSS_link_users.sql.enc
   ```

4. **Verify Data Integrity**
   ```bash
   # Run application-specific integrity checks
   kubectl exec api-gateway-0 -- /app/scripts/data-integrity-check.sh
   
   # Sample data verification
   kubectl exec postgres-primary-0 -- psql -d link_users -c "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours';"
   ```

---

### 6. Security Breach/Ransomware
**RTO**: 8 hours | **RPO**: 4 hours

**Immediate Response**:

1. **Isolate Affected Systems**
   ```bash
   # Create network policies to isolate compromised pods
   kubectl apply -f security/network-isolation.yaml
   
   # Terminate compromised instances
   kubectl delete pod <compromised-pod> --force
   
   # Block suspicious IP addresses
   kubectl apply -f security/ip-blocklist.yaml
   ```

2. **Preserve Evidence**
   ```bash
   # Create snapshots of compromised volumes
   aws ec2 create-snapshot --volume-id vol-xxxxx --description "Evidence-$(date +%Y%m%d)"
   
   # Export logs
   kubectl logs --all-containers=true --namespace=link-services > incident-logs-$(date +%Y%m%d).txt
   ```

3. **Restore from Clean Backups**
   ```bash
   # Identify last known clean backup (before breach)
   aws s3 ls s3://link-backups/postgres-backups/ | grep -v "$(date -d '1 day ago' +%Y%m%d)"
   
   # Restore from clean backup
   # Follow database recovery process above
   ```

---

## Communication Plan

### Stakeholder Notification

**Internal Notifications (< 15 minutes)**:
- Engineering team via Slack #incidents
- Management via PagerDuty escalation
- Customer support via Zendesk integration

**External Communications (< 2 hours)**:
- Status page update: https://status.linkapp.com
- Social media posts (@linkapp_status)
- Email to enterprise customers
- Push notification to mobile app users

### Communication Templates

**Initial Notification**:
```
🚨 INCIDENT ALERT
Service: Link App
Status: Investigating
Impact: [High/Medium/Low]
Start Time: [UTC]
We are investigating reports of [issue]. Updates will be provided every 30 minutes.
```

**Resolution Notice**:
```
✅ RESOLVED
The issue affecting [service] has been resolved as of [UTC].
Root cause: [brief explanation]
Full post-mortem will be available within 48 hours.
```

---

## Testing and Validation

### Monthly DR Testing Schedule

**Week 1**: Single service failover test
**Week 2**: Database backup and restore test  
**Week 3**: Cross-region failover simulation
**Week 4**: Security incident response drill

### Test Procedures

1. **Backup Restoration Test**
   ```bash
   # Create test environment
   kubectl create namespace dr-test-$(date +%Y%m%d)
   
   # Restore latest backup to test environment
   helm install link-test k8s/helm/link-app/ \
     --namespace dr-test-$(date +%Y%m%d) \
     --set database.restore=true
   
   # Run integration tests
   kubectl run test-runner --image=link/integration-tests:latest \
     --env="API_URL=http://api-gateway.dr-test-$(date +%Y%m%d):8080"
   
   # Cleanup
   kubectl delete namespace dr-test-$(date +%Y%m%d)
   ```

2. **Cross-Region Failover Test**
   ```bash
   # Simulate primary region failure
   kubectl scale deployment --all --replicas=0 --context=primary
   
   # Activate DR region
   kubectl apply -f k8s/ --context=dr
   
   # Update DNS for testing
   aws route53 change-resource-record-sets --hosted-zone-id Z123 --change-batch file://test-failover.json
   
   # Run health checks
   ./scripts/health-check.sh https://api-dr.linkapp.com
   
   # Rollback after test
   kubectl scale deployment --all --replicas=3 --context=primary
   aws route53 change-resource-record-sets --hosted-zone-id Z123 --change-batch file://rollback-primary.json
   ```

---

## Recovery Validation Checklist

After any disaster recovery event, validate the following:

### Database Validation
- [ ] All databases are accessible and responsive
- [ ] Data consistency checks pass
- [ ] Replication is functioning (if applicable)
- [ ] Backup schedules are resumed
- [ ] Performance metrics are within normal ranges

### Application Validation  
- [ ] All services are healthy and passing readiness checks
- [ ] User authentication works
- [ ] Core user journeys function (signup, login, messaging, discovery)
- [ ] File uploads/downloads work
- [ ] Push notifications are delivered
- [ ] Payment processing is functional (if applicable)

### Infrastructure Validation
- [ ] DNS resolution is correct
- [ ] SSL certificates are valid
- [ ] CDN is serving content
- [ ] Monitoring and alerting are operational
- [ ] Log aggregation is working
- [ ] Auto-scaling is configured correctly

### Performance Validation
- [ ] Response times are acceptable (< 500ms for API calls)
- [ ] Database query performance is normal
- [ ] Cache hit rates are restored
- [ ] Error rates are below 1%
- [ ] Resource utilization is optimal

---

## Post-Incident Activities

### Immediate (< 24 hours)
1. **Document Timeline**
   - Record all actions taken during recovery
   - Note any deviations from planned procedures
   - Identify what worked well and what didn't

2. **Stakeholder Update**
   - Send final resolution notice
   - Schedule post-mortem meeting
   - Update status page with "All Systems Operational"

### Short Term (< 1 week)  
1. **Post-Mortem Report**
   - Root cause analysis
   - Timeline of events
   - Actions taken and effectiveness
   - Lessons learned and improvements

2. **Process Updates**
   - Update runbooks based on lessons learned
   - Modify monitoring and alerting rules
   - Update contact information and escalation procedures

### Long Term (< 1 month)
1. **Infrastructure Improvements**
   - Implement additional redundancy if needed
   - Automate manual recovery steps
   - Enhance monitoring and observability

2. **Training Updates**
   - Conduct team training on new procedures
   - Update DR training materials
   - Schedule additional practice drills

---

## Emergency Contacts

### On-Call Rotation
- **Primary**: Engineering team (PagerDuty escalation)
- **Secondary**: DevOps team  
- **Escalation**: CTO and Engineering Managers

### External Vendors
- **AWS Support**: Enterprise Support (< 30 min response)
- **CloudFlare**: Enterprise Support
- **Database Consultant**: [Contact info]

### Key Personnel
- **Incident Commander**: [Name, Phone, Email]
- **Technical Lead**: [Name, Phone, Email]  
- **Communications Lead**: [Name, Phone, Email]
- **Security Lead**: [Name, Phone, Email]

---

## Appendices

### A. Network Diagrams
[Include detailed network topology diagrams]

### B. Backup Schedules
[Include detailed backup frequency and retention policies]

### C. Monitoring Dashboards
[Links to key monitoring dashboards and runbooks]

### D. Security Procedures
[Detailed security incident response procedures]

### E. Vendor Escalation Matrix
[Contact information and escalation procedures for all vendors]

---

*Last Updated*: $(date)
*Next Review Date*: $(date -d '+3 months')
*Document Owner*: DevOps Team
*Approved By*: CTO