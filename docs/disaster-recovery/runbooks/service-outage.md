# Complete Service Outage Response

**Severity**: SEV-1 (Critical)  
**Response Time**: < 15 minutes  
**Estimated Resolution Time**: 1-4 hours

## 📋 Overview

This runbook covers the response to complete service outages where the Link application is entirely unavailable to users. This represents the highest severity incident requiring immediate response from all on-call personnel.

## 🚨 Immediate Response (0-15 minutes)

### 1. Acknowledge and Assess (2 minutes)

```bash
# Acknowledge PagerDuty alert immediately
# Check incident details and initial alerts

# Verify outage scope - test from multiple locations
curl -I https://link-app.com
curl -I https://api.link-app.com/health

# Check status from external monitoring
curl -s https://status.link-app.com/api/v1/status.json
```

### 2. Start Incident Response (3 minutes)

```bash
# Join incident bridge
# Slack: #incident-sev1-$(date +%Y%m%d-%H%M)
# Phone bridge: [Conference number from PagerDuty]

# Start incident timeline
echo "$(date -u): Service outage detected. Starting response." >> incident-timeline.txt

# Page additional personnel for SEV-1
# PagerDuty will auto-escalate based on policy
```

### 3. Initial Status Communication (5 minutes)

```bash
# Update status page immediately
curl -X PATCH "https://api.statuspage.io/v1/pages/PAGE_ID/incidents/INCIDENT_ID" \
  -H "Authorization: OAuth TOKEN" \
  -d '{
    "incident": {
      "status": "investigating", 
      "impact_override": "critical",
      "body": "We are investigating reports of service unavailability. Updates will be provided every 15 minutes."
    }
  }'

# Notify internal stakeholders
# Slack: #general, #customer-success, #sales
# Email: leadership team via distribution list
```

### 4. Quick Health Checks (5 minutes)

```bash
# Check Kubernetes cluster status
kubectl get nodes
kubectl get pods --all-namespaces --field-selector=status.phase!=Running

# Check critical services
kubectl get deployment -n link-services
kubectl get service -n link-services
kubectl get ingress -n link-services

# Check external dependencies
curl -I https://api.openai.com/v1/models
curl -I https://api.sentry.io/
nslookup link-app.com
```

## 🔍 Detailed Investigation (15-45 minutes)

### Infrastructure Level Checks

```bash
# 1. DNS Resolution
echo "Checking DNS resolution..."
nslookup link-app.com
nslookup api.link-app.com
dig +trace link-app.com

# 2. Load Balancer Status  
echo "Checking load balancers..."
aws elbv2 describe-load-balancers --region us-west-2 --query 'LoadBalancers[?DNSName==`link-app-lb-xxx.us-west-2.elb.amazonaws.com`]'
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-west-2:ACCOUNT:targetgroup/link-app/xxx

# 3. CDN/WAF Status
echo "Checking CloudFlare status..."
curl -X GET "https://api.cloudflare.com/client/v4/zones/ZONE_ID" \
  -H "Authorization: Bearer CF_TOKEN" \
  -H "Content-Type: application/json"

# 4. Kubernetes Cluster Health
echo "Detailed cluster analysis..."
kubectl cluster-info
kubectl get componentstatuses
kubectl describe nodes | grep -E "(Ready|OutOfDisk|MemoryPressure|DiskPressure)"

# 5. Persistent Volume Status
kubectl get pv,pvc --all-namespaces
kubectl describe pv | grep -E "(Status|Claim)"
```

### Application Level Checks

```bash
# 1. Core Service Status
echo "Checking core services..."
services=("api-gateway" "user-svc" "chat-svc" "discovery-svc" "search-svc" "ai-svc" "feature-svc")

for service in "${services[@]}"; do
  echo "=== Checking $service ==="
  kubectl get deployment $service -n link-services
  kubectl get pods -l app=$service -n link-services
  kubectl logs deployment/$service -n link-services --tail=20 --since=1h | grep -E "(ERROR|FATAL|panic)"
done

# 2. Database Connectivity
echo "Checking database health..."
kubectl exec postgres-primary-0 -n link-services -- pg_isready -U postgres
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT version();"
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Cache Layer Status
echo "Checking Redis cluster..."
kubectl exec redis-cluster-0 -n link-services -- redis-cli cluster info
kubectl exec redis-cluster-0 -n link-services -- redis-cli cluster nodes
kubectl exec redis-cluster-0 -n link-services -- redis-cli info replication

# 4. Message Queue Status (if applicable)
echo "Checking message queues..."
kubectl get pods -l app=rabbitmq -n link-services
kubectl exec rabbitmq-0 -n link-services -- rabbitmqctl cluster_status
```

### External Dependencies

```bash
# 1. AWS Service Health
echo "Checking AWS service health..."
aws support describe-services --language en
aws ec2 describe-instances --region us-west-2 --query 'Reservations[].Instances[].State.Name'

# 2. Third-party APIs
echo "Testing external APIs..."
curl -I -m 10 "https://api.openai.com/v1/models"
curl -I -m 10 "https://sentry.io/api/"

# 3. Network Connectivity
echo "Network connectivity tests..."
kubectl run network-test --image=busybox --rm -it --restart=Never -- nslookup google.com
kubectl run network-test --image=busybox --rm -it --restart=Never -- wget -qO- http://httpbin.org/ip
```

## 🛠 Common Resolution Scenarios

### Scenario 1: Kubernetes Cluster Issues

```bash
# Check cluster capacity
kubectl describe nodes | grep -E "(cpu|memory).*%" 
kubectl top nodes

# If nodes are unresponsive:
echo "Cordoning problematic nodes..."
kubectl get nodes --no-headers | grep NotReady | awk '{print $1}' | xargs -I {} kubectl cordon {}

# Restart cluster DNS if needed
kubectl delete pods -n kube-system -l k8s-app=kube-dns
kubectl delete pods -n kube-system -l app=coredns

# Scale up cluster if capacity issues
eksctl scale nodegroup --cluster=link-prod-cluster --name=link-workers --nodes=6
```

### Scenario 2: Database Connection Issues

```bash
# Check database pod status
kubectl get pods -l app=postgres -n link-services -o wide

# If database pod is down:
kubectl describe pod postgres-primary-0 -n link-services
kubectl logs postgres-primary-0 -n link-services --tail=100

# Restart database if safe to do so (check replication first)
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# If master is healthy, restart replica
kubectl delete pod postgres-replica-0 -n link-services

# Connection pool issues
kubectl logs deployment/api-gateway -n link-services | grep -i "connection.*pool"
kubectl restart deployment api-gateway -n link-services
```

### Scenario 3: Load Balancer/Ingress Issues

```bash
# Check ingress controllers
kubectl get pods -n ingress-nginx
kubectl describe pod nginx-ingress-controller-xxx -n ingress-nginx

# Restart ingress controller
kubectl delete pods -l app.kubernetes.io/name=ingress-nginx -n ingress-nginx

# Check service endpoints
kubectl get endpoints -n link-services
kubectl describe service api-gateway -n link-services

# If no endpoints available, check pod selectors
kubectl get pods -l app=api-gateway -n link-services --show-labels
```

### Scenario 4: Resource Exhaustion

```bash
# Check resource usage
kubectl top pods --all-namespaces --sort-by=memory
kubectl top pods --all-namespaces --sort-by=cpu

# Check for OOMKilled pods
kubectl get events --all-namespaces --field-selector=reason=OOMKilling --sort-by='.lastTimestamp'

# Scale critical services if needed
kubectl scale deployment api-gateway --replicas=5 -n link-services
kubectl scale deployment user-svc --replicas=4 -n link-services

# Check persistent volume space
kubectl exec postgres-primary-0 -n link-services -- df -h
kubectl exec redis-cluster-0 -n link-services -- df -h

# Clean up logs if space issues
kubectl exec postgres-primary-0 -n link-services -- find /var/log -name "*.log" -mtime +7 -delete
```

## 🚀 Recovery and Validation (45-60 minutes)

### Service Restoration Checklist

```bash
# 1. Verify all pods are running
echo "=== Pod Status Check ==="
kubectl get pods --all-namespaces --field-selector=status.phase!=Running

# 2. Check service health endpoints
echo "=== Health Endpoint Checks ==="
services_health=(
  "https://api.link-app.com/health"
  "https://api.link-app.com/version"
  "https://link-app.com/"
)

for endpoint in "${services_health[@]}"; do
  echo "Checking $endpoint..."
  curl -f -m 10 "$endpoint" && echo "✅ OK" || echo "❌ FAILED"
done

# 3. Database connectivity test
echo "=== Database Connectivity ==="
kubectl exec api-gateway-0 -n link-services -- /app/scripts/db-health-check.sh

# 4. Run smoke tests
echo "=== Smoke Tests ==="
cd /path/to/tests && ./scripts/smoke-tests.sh production

# 5. Monitor error rates
echo "=== Monitoring Error Rates ==="
# Check Prometheus for error rate metrics
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=rate(http_requests_total{status=~"5.."}[5m])'
```

### Performance Validation

```bash
# Load testing after recovery
echo "Running post-recovery load test..."
k6 run --env TARGET_ENV=production --env SCENARIO=smoke tests/load/performance-baseline-test.js

# Monitor response times
echo "Checking response times..."
kubectl exec prometheus-0 -n monitoring -- promtool query instant \
  'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'

# Check database performance
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
  SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch 
  FROM pg_stat_user_tables 
  WHERE schemaname = 'public' 
  ORDER BY seq_tup_read DESC 
  LIMIT 10;"
```

## 📢 Communication Updates

### Status Page Updates

```bash
# Service restored notification
curl -X PATCH "https://api.statuspage.io/v1/pages/PAGE_ID/incidents/INCIDENT_ID" \
  -H "Authorization: OAuth TOKEN" \
  -d '{
    "incident": {
      "status": "monitoring", 
      "body": "Services have been restored and are being monitored closely. All functionality should be available."
    }
  }'

# Final resolution
curl -X PATCH "https://api.statuspage.io/v1/pages/PAGE_ID/incidents/INCIDENT_ID" \
  -H "Authorization: OAuth TOKEN" \
  -d '{
    "incident": {
      "status": "resolved", 
      "body": "This incident has been resolved. All services are functioning normally. A post-mortem will be published within 48 hours."
    }
  }'
```

### Internal Communications

```bash
# Slack notifications
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"🟢 SERVICE RESTORED: Link application is now fully operational. Monitoring continues for any residual issues."}' \
  $SLACK_WEBHOOK_URL

# Email updates (via script or API)
./scripts/send-incident-update.sh "RESOLVED" "Service has been fully restored as of $(date -u). Root cause analysis in progress."
```

## 📊 Monitoring After Resolution

### Key Metrics to Watch (Next 4 hours)

```bash
# Set up monitoring dashboard
# Focus on these metrics:

# 1. Error rates
# Target: < 1% error rate
# Query: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100

# 2. Response time  
# Target: P95 < 500ms
# Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# 3. Database connections
# Target: < 80% of max connections
# Query: pg_stat_database_numbackends / pg_settings_max_connections * 100

# 4. Memory usage
# Target: < 80% memory utilization
# Query: (1 - node_memory_available_bytes / node_memory_total_bytes) * 100

# 5. CPU utilization
# Target: < 70% CPU average
# Query: 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Automated Monitoring Setup

```bash
# Create temporary high-sensitivity alerts
kubectl apply -f - << EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: post-incident-monitoring
  namespace: monitoring
spec:
  groups:
  - name: post-incident
    rules:
    - alert: HighErrorRatePostIncident
      expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.02
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "Higher than normal error rate detected post-incident"
    
    - alert: HighLatencyPostIncident  
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Higher than normal latency detected post-incident"
EOF
```

## 📝 Post-Incident Actions

### Immediate Documentation (Within 1 hour)

```markdown
## Incident Timeline
- **Detection**: [Time] - [How incident was detected]
- **Response Started**: [Time] - [First responder actions]
- **Root Cause Identified**: [Time] - [What was found]
- **Mitigation Applied**: [Time] - [Actions taken]
- **Service Restored**: [Time] - [How restoration was verified]
- **All Clear**: [Time] - [Final monitoring confirmation]

## Root Cause
[Detailed explanation of what caused the outage]

## Resolution Actions
[Step-by-step actions taken to restore service]

## Impact Assessment  
- **Duration**: [Total outage time]
- **Affected Users**: [Number or percentage of users impacted]
- **Revenue Impact**: [If applicable]
- **SLA Impact**: [How this affects SLO compliance]
```

### Schedule Follow-up Activities

```bash
# Schedule post-mortem meeting (within 48 hours)
# Invite: All responders, engineering management, product team

# Create action items tracking
# 1. Update runbooks based on lessons learned
# 2. Implement additional monitoring/alerting
# 3. Automate manual recovery steps
# 4. Review and update incident response procedures

# Update incident response training
# Schedule review of this runbook based on what was learned
```

## 🔧 Prevention and Improvement

### Common Improvements After Service Outages

1. **Enhanced Monitoring**
   - Add synthetic monitoring for end-to-end user journeys
   - Implement more granular health checks
   - Set up chaos engineering to test failure modes

2. **Automation**  
   - Automate common recovery procedures
   - Implement auto-scaling based on demand
   - Create self-healing infrastructure patterns

3. **Infrastructure Resilience**
   - Implement circuit breakers between services
   - Add more redundancy at critical points
   - Improve database failover mechanisms

4. **Operational Excellence**
   - Improve on-call training and documentation
   - Regular disaster recovery testing
   - Enhanced incident communication processes

---

**Remember**: Stay calm, follow the checklist, communicate frequently, and don't hesitate to escalate if you need additional expertise or resources.

**Last Updated**: $(date)  
**Next Review**: Post-incident analysis  
**Maintained By**: DevOps Team