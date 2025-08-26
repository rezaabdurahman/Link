# Incident Response Runbooks

This directory contains detailed operational runbooks for responding to specific incidents and service disruptions in the Link application infrastructure.

## 📋 Available Runbooks

### Critical Infrastructure
- [`service-outage.md`](./service-outage.md) - Complete service outage response
- [`database-failures.md`](./database-failures.md) - PostgreSQL issues and recovery
- [`api-gateway-down.md`](./api-gateway-down.md) - API Gateway failures
- [`redis-cluster-failure.md`](./redis-cluster-failure.md) - Redis caching issues

### Application Services
- [`user-service-incidents.md`](./user-service-incidents.md) - Authentication and user management issues
- [`chat-service-failures.md`](./chat-service-failures.md) - Real-time messaging problems
- [`search-service-down.md`](./search-service-down.md) - Search and discovery issues
- [`ai-service-failures.md`](./ai-service-failures.md) - AI conversation summarization problems

### Security Incidents
- [`security-breach-response.md`](./security-breach-response.md) - Security incident response
- [`ddos-attack-response.md`](./ddos-attack-response.md) - DDoS attack mitigation
- [`data-leak-response.md`](./data-leak-response.md) - Data privacy incident handling

### Performance & Monitoring
- [`high-latency-response.md`](./high-latency-response.md) - Performance degradation
- [`slo-violation-response.md`](./slo-violation-response.md) - SLO breach handling
- [`monitoring-system-failures.md`](./monitoring-system-failures.md) - Observability issues

### External Dependencies
- [`third-party-service-failures.md`](./third-party-service-failures.md) - External service outages
- [`dns-issues.md`](./dns-issues.md) - DNS and domain resolution problems
- [`ssl-certificate-issues.md`](./ssl-certificate-issues.md) - TLS/SSL certificate problems

## 🚨 Incident Severity Levels

### SEV-1: Critical Impact
- **Impact**: Complete service outage or major security breach
- **Response Time**: < 15 minutes
- **Notification**: Page all on-call personnel immediately
- **Examples**: Complete site down, database corruption, security breach

### SEV-2: High Impact  
- **Impact**: Significant feature degradation affecting many users
- **Response Time**: < 30 minutes
- **Notification**: Page primary on-call, notify engineering team
- **Examples**: Login failures, chat not working, search down

### SEV-3: Medium Impact
- **Impact**: Minor feature issues or performance degradation
- **Response Time**: < 2 hours
- **Notification**: Slack notification to engineering team
- **Examples**: Slow API responses, feature flag issues, minor bugs

### SEV-4: Low Impact
- **Impact**: Cosmetic issues or very limited functionality problems  
- **Response Time**: Next business day
- **Notification**: Ticket in backlog
- **Examples**: UI glitches, documentation errors, non-critical logs

## 📞 Incident Response Process

### 1. Detection & Alerting
- Automated monitoring detects issue
- Alert sent via PagerDuty, Slack, or email
- On-call engineer acknowledges alert within SLA

### 2. Initial Assessment (5 minutes)
- Determine incident severity level
- Identify affected systems and user impact
- Start incident timeline documentation
- Join incident bridge if SEV-1 or SEV-2

### 3. Response & Mitigation
- Follow appropriate runbook procedures
- Implement immediate mitigations to reduce impact
- Communicate status updates every 30 minutes
- Escalate if resolution time exceeds targets

### 4. Resolution & Recovery
- Implement permanent fix
- Verify service restoration
- Monitor for regression or additional issues
- Update status page and stakeholder communications

### 5. Post-Incident Activities
- Conduct post-mortem meeting within 48 hours
- Document lessons learned and action items
- Update runbooks and monitoring as needed
- Implement preventive measures

## 🔧 General Troubleshooting Tools

### Kubernetes Commands
```bash
# Check cluster status
kubectl get nodes
kubectl get pods --all-namespaces

# Service health
kubectl describe service <service-name>
kubectl get endpoints <service-name>

# Pod debugging
kubectl logs <pod-name> --previous
kubectl exec -it <pod-name> -- /bin/bash
kubectl describe pod <pod-name>

# Resource usage
kubectl top pods
kubectl top nodes
```

### Database Commands
```bash
# PostgreSQL health check
kubectl exec postgres-primary-0 -- pg_isready -U postgres

# Connection count
kubectl exec postgres-primary-0 -- psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Replication status
kubectl exec postgres-primary-0 -- psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# Lock analysis
kubectl exec postgres-primary-0 -- psql -U postgres -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

### Redis Commands
```bash
# Redis cluster status
kubectl exec redis-cluster-0 -- redis-cli cluster info
kubectl exec redis-cluster-0 -- redis-cli cluster nodes

# Memory usage
kubectl exec redis-cluster-0 -- redis-cli info memory

# Key analysis
kubectl exec redis-cluster-0 -- redis-cli --bigkeys
kubectl exec redis-cluster-0 -- redis-cli monitor
```

### Monitoring Commands
```bash
# Prometheus queries
curl -G 'http://prometheus:9090/api/v1/query' --data-urlencode 'query=up{job="api-gateway"}'

# Grafana API
curl -H "Authorization: Bearer $GRAFANA_TOKEN" http://grafana:3000/api/alerts

# Log analysis
kubectl logs deployment/api-gateway | grep -E "(ERROR|FATAL)"
kubectl logs deployment/user-svc --since=1h | wc -l
```

## 📚 Using These Runbooks

### Before An Incident
1. **Familiarize yourself** with common runbooks during on-call shifts
2. **Validate access** to all required systems and tools
3. **Test procedures** during scheduled maintenance windows
4. **Update contact information** and escalation procedures regularly

### During An Incident
1. **Stay calm** and follow the runbook procedures systematically
2. **Document actions** taken and their results for post-mortem
3. **Communicate regularly** with stakeholders and team members
4. **Don't hesitate** to escalate if the issue exceeds your expertise

### After An Incident
1. **Complete the timeline** of events and actions taken
2. **Identify gaps** in the runbook or tools that need improvement
3. **Participate actively** in the post-mortem discussion
4. **Implement improvements** to prevent similar incidents

## 🔄 Runbook Maintenance

### Monthly Reviews
- Review and update runbooks based on recent incidents
- Test critical procedures in staging environments
- Validate contact information and escalation paths
- Update tool versions and command syntax

### Quarterly Updates
- Conduct tabletop exercises with engineering team
- Review and update severity definitions
- Analyze incident patterns and update preventive measures
- Align runbooks with infrastructure changes

## 🆘 Emergency Contacts

### Immediate Response
- **On-Call Engineer**: PagerDuty escalation
- **Incident Commander**: [Contact information in company directory]
- **Technical Lead**: [Backup contact for complex issues]

### Escalation
- **Engineering Manager**: For resource allocation decisions
- **CTO**: For major outages or security incidents
- **Legal/Compliance**: For data breach or privacy incidents

### External Support
- **AWS Support**: Enterprise Support Case
- **Sentry**: Enterprise Support Ticket
- **PagerDuty**: Escalation via platform

---

**Important**: These runbooks are living documents. If you encounter a situation not covered by existing runbooks, document your response and create a new runbook for future incidents.

**Last Updated**: $(date)  
**Next Review**: $(date -d '+1 month')  
**Maintained By**: DevOps Team