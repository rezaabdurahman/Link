# Security Breach Response

**Severity**: SEV-1 (Critical)  
**Response Time**: < 10 minutes  
**Estimated Resolution Time**: 4-24 hours  
**⚠️ CAUTION**: Preserve evidence - do not destroy logs or data

## 📋 Overview

This runbook provides step-by-step guidance for responding to security incidents including data breaches, unauthorized access, malware detection, and other security emergencies affecting the Link application.

## 🚨 IMMEDIATE RESPONSE (0-15 minutes)

### ⚠️ CRITICAL: Evidence Preservation First

```bash
# 1. BEFORE taking any remediation actions, preserve evidence
echo "Starting security incident response at $(date -u)" >> security-incident-$(date +%Y%m%d-%H%M).log

# 2. Take snapshots of affected systems IMMEDIATELY
affected_pods=$(kubectl get pods -n link-services --field-selector=status.phase=Running -o name | head -5)
for pod in $affected_pods; do
  kubectl exec $pod -n link-services -- ps aux > evidence/ps-$pod-$(date +%Y%m%d-%H%M).txt
  kubectl logs $pod -n link-services > evidence/logs-$pod-$(date +%Y%m%d-%H%M).txt
done

# 3. Capture network state
kubectl get networkpolicies --all-namespaces > evidence/network-policies-$(date +%Y%m%d-%H%M).yaml
kubectl get services --all-namespaces > evidence/services-$(date +%Y%m%d-%H%M).yaml

# 4. Create EBS snapshots of critical volumes
aws ec2 describe-volumes --region us-west-2 --filters "Name=tag:Environment,Values=production" --query 'Volumes[].VolumeId' | \
xargs -I {} aws ec2 create-snapshot --volume-id {} --description "Security-incident-$(date +%Y%m%d-%H%M)"
```

### 📞 Immediate Notifications

```bash
# 1. Page security team immediately
# PagerDuty: Create SEV-1 incident with "SECURITY BREACH" title

# 2. Notify key personnel
# - CISO/Security Team
# - CTO
# - Legal Team
# - Compliance Team (if regulated data involved)

# 3. Start incident bridge
# Slack: #security-incident-$(date +%Y%m%d-%H%M)
# Bridge: [Use secure conference line]

# 4. Start incident timeline
cat >> security-incident-timeline.md << EOF
# Security Incident Timeline

**Incident ID**: SEC-$(date +%Y%m%d-%H%M)  
**Start Time**: $(date -u)  
**Incident Commander**: [Name]  
**Security Lead**: [Name]  

## Timeline
- $(date -u): Incident detected - [brief description]
EOF
```

### 🔒 Immediate Containment

```bash
# 1. Isolate potentially compromised systems
# Create network policy to isolate affected pods
kubectl apply -f - << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: security-isolation-$(date +%Y%m%d-%H%M)
  namespace: link-services
spec:
  podSelector:
    matchLabels:
      security-isolated: "true"
  policyTypes:
  - Ingress
  - Egress
  ingress: []
  egress: []
EOF

# 2. Block suspicious IP addresses immediately
suspicious_ips=("1.2.3.4" "5.6.7.8")  # Replace with actual IPs
for ip in "${suspicious_ips[@]}"; do
  kubectl apply -f - << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-ip-$(echo $ip | tr '.' '-')
  namespace: link-services
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  ingress:
  - from:
    - ipBlock:
        cidr: $ip/32
    ports: []
EOF
done

# 3. Revoke potentially compromised API tokens/keys
# This depends on your specific incident - common actions:
# - Rotate AWS access keys
# - Revoke database passwords  
# - Invalidate JWT tokens
# - Disable compromised user accounts
```

## 🔍 ASSESSMENT AND INVESTIGATION (15-60 minutes)

### Incident Classification

```bash
# Determine incident type and scope
echo "=== INCIDENT CLASSIFICATION ==="
echo "Date/Time: $(date -u)"
echo "Detected by: [monitoring system / user report / external notification]"
echo "Initial indicators: [describe what was observed]"
echo "Suspected threat type: [malware / data breach / unauthorized access / DDoS / other]"
echo "Affected systems: [list known affected systems]"
echo "Data at risk: [PII / financial / intellectual property / credentials / other]"
```

### Security Log Analysis

```bash
# 1. Check application logs for suspicious activity
echo "=== APPLICATION LOG ANALYSIS ==="
kubectl logs deployment/api-gateway -n link-services --since=4h | grep -E "(401|403|500|failed.*login|unauthorized|suspicious)" > evidence/api-security-logs.txt

# 2. Check authentication logs
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
SELECT 
  email, 
  login_attempts,
  last_login_at,
  last_failed_login_at,
  created_at
FROM users 
WHERE last_failed_login_at > NOW() - INTERVAL '4 hours'
   OR login_attempts > 5
ORDER BY last_failed_login_at DESC;" > evidence/suspicious-logins.txt

# 3. Check for unusual API patterns
kubectl logs deployment/api-gateway -n link-services --since=4h | \
awk '{print $1, $7}' | sort | uniq -c | sort -nr | head -20 > evidence/api-request-patterns.txt

# 4. Analyze network connections
kubectl exec api-gateway-0 -n link-services -- netstat -tulpn > evidence/network-connections.txt
kubectl exec api-gateway-0 -n link-services -- ss -tuln > evidence/socket-stats.txt
```

### System Integrity Checks

```bash
# 1. Check for unauthorized processes
kubectl get pods --all-namespaces | grep -v -E "(Running|Completed)" > evidence/pod-anomalies.txt

# 2. Check for file modifications
for pod in $(kubectl get pods -n link-services -o name); do
  echo "=== Checking $pod ===" >> evidence/file-changes.txt
  kubectl exec $pod -n link-services -- find /app -type f -newer /tmp/baseline -ls 2>/dev/null >> evidence/file-changes.txt || true
done

# 3. Check for suspicious environment variables or configs
kubectl get configmaps --all-namespaces -o yaml > evidence/configmaps-$(date +%Y%m%d).yaml
kubectl get secrets --all-namespaces -o yaml > evidence/secrets-$(date +%Y%m%d).yaml

# 4. Memory dump of critical processes (if needed)
# kubectl exec api-gateway-0 -n link-services -- gcore $(pidof main-process) > evidence/memory-dump.core
```

### Data Access Audit

```bash
# 1. Check database access logs
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT 
  datname,
  usename,
  client_addr,
  query_start,
  state,
  query
FROM pg_stat_activity
WHERE query_start > NOW() - INTERVAL '4 hours'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start DESC;" > evidence/db-access-audit.txt

# 2. Check for data exfiltration patterns
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
SELECT 
  email,
  COUNT(*) as query_count,
  MAX(created_at) as last_query
FROM audit_log 
WHERE created_at > NOW() - INTERVAL '4 hours'
  AND action IN ('SELECT', 'EXPORT', 'DOWNLOAD')
GROUP BY email
HAVING COUNT(*) > 100
ORDER BY query_count DESC;" > evidence/potential-exfiltration.txt

# 3. Check S3 access logs (if applicable)
aws s3api get-bucket-logging --bucket link-app-data > evidence/s3-access-config.json
aws logs filter-log-events \
  --log-group-name "/aws/s3/link-app-data" \
  --start-time $(date -d '4 hours ago' +%s)000 \
  --filter-pattern "ERROR" > evidence/s3-errors.json
```

## 🛡️ CONTAINMENT STRATEGIES

### Scenario 1: Unauthorized Access / Account Compromise

```bash
# 1. Identify compromised accounts
compromised_accounts=("user@example.com" "admin@example.com")  # Replace with actual accounts

# 2. Disable compromised accounts immediately
for account in "${compromised_accounts[@]}"; do
  kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
    UPDATE users SET is_active = false, locked_at = NOW() WHERE email = '$account';"
  echo "$(date -u): Disabled account $account" >> security-incident-timeline.md
done

# 3. Force logout all sessions for affected users
kubectl exec redis-cluster-0 -n link-services -- redis-cli --scan --pattern "session:*" | \
xargs kubectl exec redis-cluster-0 -n link-services -- redis-cli del

# 4. Reset passwords and require re-authentication
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
  UPDATE users 
  SET password_hash = 'FORCE_RESET', password_reset_required = true 
  WHERE email IN ('${compromised_accounts[0]}', '${compromised_accounts[1]}');"

# 5. Revoke API tokens
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
  UPDATE api_tokens 
  SET revoked_at = NOW(), is_active = false 
  WHERE user_id IN (SELECT id FROM users WHERE email IN ('${compromised_accounts[0]}', '${compromised_accounts[1]}'));"
```

### Scenario 2: Malware Detection

```bash
# 1. Quarantine infected pods
infected_pods=("api-gateway-0" "user-svc-0")  # Replace with actual pods

for pod in "${infected_pods[@]}"; do
  # Label pod for isolation
  kubectl label pod $pod -n link-services security-isolated=true
  
  # Remove from service endpoints
  kubectl label pod $pod -n link-services app-
  
  # Create new clean pods
  kubectl scale deployment $(kubectl get pod $pod -n link-services -o jsonpath='{.metadata.labels.app}') --replicas=$(($(kubectl get deployment $(kubectl get pod $pod -n link-services -o jsonpath='{.metadata.labels.app}') -n link-services -o jsonpath='{.spec.replicas}') + 1))
  
  echo "$(date -u): Quarantined pod $pod and scaled up replacement" >> security-incident-timeline.md
done

# 2. Scan remaining systems
kubectl run malware-scanner --image=clamav/clamav:latest --rm -it --restart=Never -- clamscan -r /host-filesystem

# 3. Check for persistence mechanisms
kubectl get cronjobs --all-namespaces > evidence/cronjobs-$(date +%Y%m%d).yaml
kubectl get jobs --all-namespaces > evidence/jobs-$(date +%Y%m%d).yaml
```

### Scenario 3: Data Exfiltration Suspected

```bash
# 1. Block all external traffic temporarily (emergency measure)
kubectl apply -f - << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: emergency-external-block
  namespace: link-services
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector: {}
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
EOF

# 2. Monitor current connections
kubectl exec api-gateway-0 -n link-services -- netstat -tulpn | grep ESTABLISHED > evidence/active-connections-$(date +%Y%m%d-%H%M).txt

# 3. Check for large data transfers
kubectl top pods --all-namespaces --sort-by=memory > evidence/memory-usage-$(date +%Y%m%d-%H%M).txt
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
  SELECT 
    query, 
    query_start, 
    state,
    backend_start
  FROM pg_stat_activity 
  WHERE query LIKE '%SELECT%' 
    AND query_start > NOW() - INTERVAL '1 hour'
  ORDER BY query_start DESC;" > evidence/large-queries-$(date +%Y%m%d-%H%M).txt

# 4. Implement DLP measures
# Block file downloads temporarily
kubectl patch configmap api-gateway-config -n link-services --patch='{"data":{"disable_file_downloads":"true"}}'
kubectl rollout restart deployment api-gateway -n link-services
```

## 🔧 ERADICATION AND RECOVERY

### Clean System Recovery

```bash
# 1. Deploy clean container images
echo "=== DEPLOYING CLEAN IMAGES ==="
# Use known-good images from before suspected compromise
kubectl set image deployment/api-gateway api-gateway=link/api-gateway:known-good-sha -n link-services
kubectl set image deployment/user-svc user-svc=link/user-svc:known-good-sha -n link-services

# 2. Rotate all secrets and credentials
echo "=== ROTATING SECRETS ==="
# Database passwords
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "ALTER USER link_api WITH PASSWORD '$(openssl rand -base64 32)';"

# API keys
kubectl create secret generic api-keys \
  --from-literal=openai-api-key="$(openssl rand -base64 32)" \
  --from-literal=sentry-dsn="https://new-dsn@sentry.io/project" \
  --dry-run=client -o yaml | kubectl apply -f - -n link-services

# 3. Update firewall rules and network policies
kubectl apply -f k8s/security/network-policies-hardened.yaml

# 4. Enable additional monitoring
kubectl apply -f - << EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: security-monitoring-enhanced
  namespace: monitoring
spec:
  groups:
  - name: security-post-incident
    rules:
    - alert: SuspiciousLoginAttempts
      expr: rate(failed_login_attempts_total[5m]) > 10
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "High rate of failed login attempts detected"
    
    - alert: UnauthorizedAPIAccess
      expr: rate(http_requests_total{status="401"}[5m]) > 50
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "High rate of unauthorized API access"
EOF
```

### Data Integrity Verification

```bash
# 1. Check database integrity
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
  SELECT 
    schemaname, 
    tablename, 
    n_tup_ins, 
    n_tup_upd, 
    n_tup_del
  FROM pg_stat_user_tables 
  ORDER BY n_tup_upd + n_tup_del DESC;"

# 2. Verify critical data hasn't been modified
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
  SELECT COUNT(*) as total_users FROM users;
  SELECT COUNT(*) as active_users FROM users WHERE is_active = true;
  SELECT MAX(created_at) as latest_user FROM users;"

# 3. Run data consistency checks
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "
  -- Check for orphaned records
  SELECT COUNT(*) as orphaned_messages FROM messages m 
  LEFT JOIN users u ON m.user_id = u.id 
  WHERE u.id IS NULL;
  
  -- Check for data anomalies
  SELECT COUNT(*) as suspicious_bulk_creates FROM users 
  WHERE created_at > NOW() - INTERVAL '4 hours';
"

# 4. Restore from clean backup if data integrity is compromised
if [ "$data_compromised" = "true" ]; then
  echo "Data integrity compromised, initiating restore from clean backup"
  # Scale down applications
  kubectl scale deployment --all --replicas=0 -n link-services
  
  # Restore database from pre-incident backup
  ./scripts/restore-postgres-from-backup.sh "$(date -d '1 day ago' +%Y%m%d)"
  
  # Verify restoration
  kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -d link_users -c "SELECT COUNT(*) FROM users;"
fi
```

## 📊 POST-INCIDENT ACTIVITIES

### Evidence Collection and Analysis

```bash
# 1. Compile complete evidence package
mkdir -p security-incident-$(date +%Y%m%d)/evidence
tar -czf security-incident-$(date +%Y%m%d)/evidence-package.tar.gz evidence/

# 2. Generate incident report
cat > security-incident-$(date +%Y%m%d)/incident-report.md << EOF
# Security Incident Report

**Incident ID**: SEC-$(date +%Y%m%d-%H%M)
**Date/Time**: $(date -u)
**Incident Commander**: [Name]
**Security Lead**: [Name]

## Incident Summary
[Describe what happened, how it was detected, and impact]

## Timeline of Events
$(cat security-incident-timeline.md)

## Root Cause Analysis
[Detailed analysis of how the incident occurred]

## Actions Taken
[List all containment, eradication, and recovery actions]

## Impact Assessment
- **Data Affected**: [Specify type and amount of data]
- **Users Affected**: [Number and type of users]
- **Systems Compromised**: [List all affected systems]
- **Duration**: [Total incident duration]
- **Business Impact**: [Financial and operational impact]

## Evidence Collected
- Application logs
- Database audit logs
- Network traffic analysis
- System snapshots
- Memory dumps (if applicable)

## Lessons Learned
[What went well, what could be improved]

## Recommendations
[Specific improvements to prevent similar incidents]
EOF

# 3. Legal and compliance notifications (if required)
if [ "$pii_involved" = "true" ]; then
  echo "PII breach detected - initiating regulatory notifications"
  # Notify legal team for breach notification requirements
  # GDPR: 72 hours for data protection authority
  # CCPA: Without unreasonable delay
  # State laws: Varies by jurisdiction
fi
```

### System Hardening

```bash
# 1. Implement additional security controls
kubectl apply -f - << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-hardening
  namespace: link-services
data:
  # Enhanced security settings
  max_login_attempts: "3"
  account_lockout_duration: "900"
  password_complexity_required: "true"
  session_timeout: "1800"
  require_mfa_for_admin: "true"
EOF

# 2. Update Web Application Firewall rules
# Add patterns based on attack indicators found

# 3. Implement additional monitoring
kubectl apply -f k8s/monitoring/security-monitoring-enhanced.yaml

# 4. Schedule security scans
kubectl create cronjob security-scan \
  --image=security-scanner:latest \
  --schedule="0 2 * * *" \
  -- /app/scan-all-services.sh
```

### Communication Plan

```bash
# Internal notifications
echo "Sending internal security incident summary..."
# Notify:
# - All engineering staff
# - Management team
# - Legal and compliance
# - Customer success (for customer communications)

# Customer communication (if required)
if [ "$customer_impact" = "true" ]; then
  # Draft customer notification
  cat > customer-notification.md << EOF
# Security Incident Notification

Dear Link Users,

We want to inform you about a security incident that occurred on [DATE]. 

**What Happened**: [Brief description]
**Information Involved**: [What data was affected]  
**What We're Doing**: [Actions taken to secure systems]
**What You Should Do**: [User actions like password reset]

We sincerely apologize for this incident and any inconvenience caused.

The Link Security Team
EOF
fi

# External notifications (if legally required)
# Data protection authorities
# Law enforcement (if criminal activity suspected)
# Cyber insurance provider
# Key business partners/vendors
```

## 🔧 PREVENTION MEASURES

### Immediate Improvements

```bash
# 1. Implement enhanced authentication
kubectl apply -f - << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-enhancements
  namespace: link-services
data:
  mfa_required_for_admin: "true"
  password_min_length: "12"
  password_require_special_chars: "true"
  session_max_duration: "3600"
  concurrent_session_limit: "3"
EOF

# 2. Deploy additional security tools
kubectl apply -f k8s/security/runtime-security-monitoring.yaml
kubectl apply -f k8s/security/network-intrusion-detection.yaml

# 3. Implement zero-trust network policies
kubectl apply -f k8s/security/zero-trust-network-policies.yaml

# 4. Enhanced logging and monitoring
kubectl apply -f k8s/security/security-audit-logging.yaml
```

### Long-term Security Improvements

1. **Security Training and Awareness**
   - Mandatory security training for all engineers
   - Phishing simulation exercises
   - Security incident response drills

2. **Technical Improvements**
   - Implement service mesh with mTLS
   - Add runtime security monitoring
   - Implement secrets rotation automation
   - Deploy intrusion detection systems

3. **Process Improvements**
   - Regular security audits and penetration testing
   - Automated vulnerability scanning
   - Security review for all code changes
   - Enhanced vendor risk assessments

## ⚠️ IMPORTANT REMINDERS

1. **Legal Obligations**
   - Document everything for potential legal proceedings
   - Preserve evidence even after incident resolution
   - Follow breach notification laws and timelines
   - Consider involving law enforcement for criminal activity

2. **Communication**
   - Be factual and avoid speculation
   - Coordinate all external communications through legal/PR
   - Maintain confidentiality of investigation details
   - Regular updates to stakeholders

3. **Evidence Handling**
   - Maintain chain of custody for digital evidence
   - Use forensically sound methods for evidence collection
   - Create cryptographic hashes of evidence files
   - Store evidence securely with restricted access

---

**CRITICAL**: This runbook deals with sensitive security matters. Ensure all actions are logged, evidence is preserved, and proper notifications are made according to legal and regulatory requirements.

**Last Updated**: $(date)  
**Next Review**: Post-incident analysis  
**Maintained By**: Security Team & DevOps Team