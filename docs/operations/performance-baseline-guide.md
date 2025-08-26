# Performance Baseline Monitoring Guide

## Overview

Performance baseline monitoring establishes and maintains performance standards for the Link platform. This system continuously monitors key performance indicators (KPIs) against established baselines and provides automated analysis and recommendations.

## Performance Baselines

### Service Level Objectives (SLOs)

| Metric | Target | Critical Threshold | Impact |
|--------|---------|-------------------|---------|
| **Availability** | ≥99.9% | <99.5% | Revenue loss, SLA violations |
| **Latency P95** | ≤500ms | >2000ms | User experience degradation |
| **Latency P99** | ≤2000ms | >5000ms | Severe UX issues for tail users |
| **Error Rate** | ≤1% | >5% | Service reliability issues |
| **CPU Utilization** | ≤80% | >90% | Performance degradation risk |
| **Memory Utilization** | ≤85% | >95% | OOM kill risk |
| **Database Queries P95** | ≤250ms | >1000ms | Application slowdown |
| **Throughput** | ≥100 req/s | <50 req/s | Capacity issues |

## Monitoring Infrastructure

### Components

1. **Prometheus Rules** (`monitoring/performance/performance-baseline-rules.yaml`)
   - Recording rules for performance metrics
   - Alert rules for baseline violations
   - SLO compliance tracking

2. **Grafana Dashboard** (`monitoring/performance/performance-dashboard.yaml`)
   - Real-time performance visualization
   - SLO compliance status
   - Trend analysis

3. **Analysis Script** (`scripts/performance-baseline-analyzer.sh`)
   - Automated performance analysis
   - Recommendation generation
   - HTML report creation

### Metrics Collection

Performance metrics are collected from multiple sources:

```yaml
# HTTP request metrics
http_request_duration_seconds_bucket{namespace="link-services"}
http_requests_total{namespace="link-services"}

# Resource utilization
container_cpu_usage_seconds_total{namespace="link-services"}
container_memory_working_set_bytes{namespace="link-services"}

# Database performance
pg_stat_statements_mean_exec_time_bucket
pg_stat_database_numbackends

# Application-specific metrics
custom_business_metrics_total
```

## Alert Configuration

### Alert Hierarchy

1. **Critical Alerts** (P0/P1)
   - Availability SLO violations
   - Extreme latency (P99 >5s)
   - High error rates (>5%)
   - Immediate escalation required

2. **Warning Alerts** (P2)
   - Performance degradation trends
   - Resource utilization thresholds
   - Database performance issues
   - Investigation required

3. **Info Alerts** (P3)
   - Performance trend changes
   - Optimization opportunities
   - Scheduled reviews

### Alert Routing

```yaml
# Example alert routing configuration
route:
  group_by: ['severity', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
  - match:
      severity: critical
    receiver: 'pager-duty'
  - match:
      severity: warning
    receiver: 'slack-alerts'
```

## Usage Instructions

### Running Performance Analysis

#### Basic Analysis
```bash
# Analyze current performance against baselines
./scripts/performance-baseline-analyzer.sh

# Output includes:
# - JSON metrics file
# - Compliance analysis
# - Actionable recommendations
# - HTML report for stakeholders
```

#### Advanced Options
```bash
# Run with load testing first
./scripts/performance-baseline-analyzer.sh --load-test

# Use custom Prometheus URL
./scripts/performance-baseline-analyzer.sh --prometheus-url http://prometheus.example.com:9090

# Target different namespace
./scripts/performance-baseline-analyzer.sh --namespace production-services
```

### Interpreting Results

#### Compliance Scoring
- **90-100%**: Excellent - All baselines met
- **75-89%**: Good - Minor optimizations needed
- **60-74%**: Needs Improvement - Performance issues present
- **<60%**: Critical - Immediate action required

#### Report Sections

1. **Executive Summary**
   - Overall compliance score
   - Key performance indicators
   - Status overview

2. **Detailed Analysis**
   - Metric-by-metric compliance
   - Variance from baselines
   - Trend analysis

3. **Recommendations**
   - Prioritized action items
   - Expected impact
   - Implementation guidance

## Performance Optimization Playbook

### Latency Optimization

#### High P95 Latency (>500ms)
```bash
# 1. Database query analysis
kubectl exec postgres-primary-0 -n link-services -- psql -U postgres -c "
SELECT query, mean_exec_time, calls, total_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;"

# 2. Application profiling
kubectl logs -n link-services deployment/api-gateway --tail=1000 | grep "slow"

# 3. Cache hit rate analysis
kubectl exec redis-0 -n link-services -- redis-cli INFO stats | grep hit_rate
```

#### Actions:
- Optimize slow database queries
- Implement result caching
- Review external service calls
- Add database indexes

### Error Rate Reduction

#### High Error Rate (>1%)
```bash
# 1. Error pattern analysis
kubectl logs -n link-services -l app=api-gateway --tail=5000 | grep "ERROR" | sort | uniq -c

# 2. Service health checks
for service in user-svc chat-svc discovery-svc ai-svc search-svc feature-svc; do
  echo "=== $service health ==="
  kubectl exec -n link-services deployment/$service -- curl -s http://localhost:8080/health
done
```

#### Actions:
- Fix identified application bugs
- Implement retry mechanisms
- Add circuit breakers
- Improve error handling

### Resource Optimization

#### High CPU/Memory Usage
```bash
# 1. Resource utilization by pod
kubectl top pods -n link-services --sort-by=cpu

# 2. Container resource limits
kubectl get pods -n link-services -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].resources}{"\n"}{end}'

# 3. Horizontal Pod Autoscaler status
kubectl get hpa -n link-services
```

#### Actions:
- Right-size resource requests/limits
- Implement horizontal pod autoscaling
- Optimize memory usage patterns
- Profile CPU-intensive operations

## Automation and Integration

### Continuous Monitoring

#### Scheduled Analysis
```bash
# Add to crontab for automated daily analysis
0 2 * * * /path/to/performance-baseline-analyzer.sh --load-test > /var/log/performance-analysis.log 2>&1
```

#### CI/CD Integration
```yaml
# Example GitHub Actions workflow
name: Performance Baseline Check
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM
  workflow_dispatch:

jobs:
  performance-analysis:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run Performance Analysis
      run: |
        ./scripts/performance-baseline-analyzer.sh
        # Upload results to artifact storage
```

### Alert Integration

#### Slack Notifications
```bash
# Example webhook integration in alertmanager
- name: 'slack-performance'
  slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK_URL'
    title: 'Performance Alert: {{ .GroupLabels.alertname }}'
    text: '{{ .CommonAnnotations.summary }}'
    actions:
    - type: button
      text: 'View Dashboard'
      url: '{{ .CommonAnnotations.dashboard_url }}'
```

## Troubleshooting

### Common Issues

#### Missing Metrics
```bash
# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# Verify service monitors
kubectl get servicemonitor -n monitoring
```

#### Inaccurate Baselines
```bash
# Recalibrate baselines with recent data
./scripts/performance-baseline-analyzer.sh --load-test

# Update baseline targets in script
vim scripts/performance-baseline-analyzer.sh
# Modify PERFORMANCE_TARGETS array
```

#### Dashboard Issues
```bash
# Verify Grafana data source
kubectl port-forward -n monitoring svc/grafana 3000:3000

# Check dashboard import
kubectl logs -n monitoring deployment/grafana | grep -i dashboard
```

### Performance Regression Detection

#### Automated Regression Tests
```bash
# Run before/after deployment comparison
./scripts/performance-baseline-analyzer.sh > before_deployment.json

# After deployment
./scripts/performance-baseline-analyzer.sh > after_deployment.json

# Compare results
jq --slurpfile before before_deployment.json --slurpfile after after_deployment.json -n '
  $after[0].analysis.overall_compliance_score - $before[0].analysis.overall_compliance_score
'
```

## Best Practices

### Monitoring Strategy

1. **Establish Baselines Early**
   - Define SLOs based on user needs
   - Use statistical analysis for realistic targets
   - Account for business growth patterns

2. **Continuous Improvement**
   - Regular baseline review and updates
   - Performance optimization sprints
   - Proactive capacity planning

3. **Alert Hygiene**
   - Minimize alert fatigue
   - Actionable alerts only
   - Clear escalation procedures

### Performance Culture

1. **Development Integration**
   - Performance requirements in user stories
   - Load testing in CI/CD pipelines
   - Performance reviews in code reviews

2. **Operational Excellence**
   - Regular performance health checks
   - Performance incident post-mortems
   - Knowledge sharing and training

3. **Business Alignment**
   - Performance KPIs tied to business metrics
   - Regular stakeholder reporting
   - Performance-cost trade-off discussions

## Reference Links

- [Prometheus Recording Rules](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/best-practices/best-practices-for-managing-dashboards/)
- [SLO and SLA Design](https://sre.google/sre-book/service-level-objectives/)
- [K6 Load Testing](https://k6.io/docs/)
- [Performance Testing Strategy](https://martinfowler.com/articles/practical-test-pyramid.html)