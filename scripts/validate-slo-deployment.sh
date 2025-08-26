#!/bin/bash

# SLO Monitoring Deployment Validator
# Validates that SLO monitoring is properly deployed and configured

set -euo pipefail

# Configuration
NAMESPACE="monitoring"
SERVICES_NAMESPACE="link-services"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if kubectl is available
check_kubectl() {
    if ! kubectl cluster-info &>/dev/null; then
        log_error "kubectl not available or cluster not accessible"
        exit 1
    fi
    log_success "Kubernetes cluster accessible"
}

# Function to check ArgoCD applications
check_argocd_apps() {
    log_info "Checking ArgoCD monitoring applications..."
    
    local apps=("prometheus-stack" "loki-stack" "jaeger-tracing" "custom-dashboards" "alert-rules")
    local all_healthy=true
    
    for app in "${apps[@]}"; do
        if kubectl get application "$app" -n argocd &>/dev/null; then
            local status=$(kubectl get application "$app" -n argocd -o jsonpath='{.status.health.status}')
            local sync_status=$(kubectl get application "$app" -n argocd -o jsonpath='{.status.sync.status}')
            
            if [[ "$status" == "Healthy" && "$sync_status" == "Synced" ]]; then
                log_success "ArgoCD app '$app': Healthy & Synced"
            else
                log_warning "ArgoCD app '$app': Status=$status, Sync=$sync_status"
                all_healthy=false
            fi
        else
            log_error "ArgoCD application '$app' not found"
            all_healthy=false
        fi
    done
    
    if $all_healthy; then
        log_success "All ArgoCD monitoring applications are healthy"
    else
        log_warning "Some ArgoCD applications need attention"
    fi
}

# Function to check Prometheus deployment
check_prometheus() {
    log_info "Checking Prometheus deployment..."
    
    if kubectl get statefulset prometheus-prometheus-stack-kube-prom-prometheus -n "$NAMESPACE" &>/dev/null; then
        local ready_replicas=$(kubectl get statefulset prometheus-prometheus-stack-kube-prom-prometheus -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        local desired_replicas=$(kubectl get statefulset prometheus-prometheus-stack-kube-prom-prometheus -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        
        if [[ "$ready_replicas" == "$desired_replicas" ]]; then
            log_success "Prometheus StatefulSet: $ready_replicas/$desired_replicas replicas ready"
        else
            log_warning "Prometheus StatefulSet: $ready_replicas/$desired_replicas replicas ready"
        fi
    else
        log_error "Prometheus StatefulSet not found"
        return 1
    fi
    
    # Check if Prometheus is accessible
    log_info "Checking Prometheus accessibility..."
    kubectl port-forward -n "$NAMESPACE" svc/prometheus-stack-kube-prom-prometheus 9090:9090 &>/dev/null &
    local pf_pid=$!
    sleep 3
    
    if curl -s http://localhost:9090/api/v1/status/config &>/dev/null; then
        log_success "Prometheus API is accessible"
    else
        log_error "Prometheus API is not accessible"
    fi
    
    kill $pf_pid &>/dev/null || true
}

# Function to check SLO PrometheusRules
check_slo_rules() {
    log_info "Checking SLO Prometheus rules..."
    
    local rules=("performance-baseline-rules" "service-level-objectives" "cost-alerts" "prometheus-cost-rules")
    local all_rules_present=true
    
    for rule in "${rules[@]}"; do
        if kubectl get prometheusrule "$rule" -n "$NAMESPACE" &>/dev/null; then
            log_success "PrometheusRule '$rule' is deployed"
        else
            log_error "PrometheusRule '$rule' is missing"
            all_rules_present=false
        fi
    done
    
    if $all_rules_present; then
        log_success "All SLO Prometheus rules are deployed"
    else
        log_error "Some SLO Prometheus rules are missing"
    fi
}

# Function to check SLO metrics availability
check_slo_metrics() {
    log_info "Checking SLO metrics availability..."
    
    # Port forward to Prometheus
    kubectl port-forward -n "$NAMESPACE" svc/prometheus-stack-kube-prom-prometheus 9090:9090 &>/dev/null &
    local pf_pid=$!
    sleep 5
    
    local slo_metrics=("slo:availability_7d" "slo:latency_compliance_7d")
    local metrics_available=true
    
    for metric in "${slo_metrics[@]}"; do
        local query_result=$(curl -s "http://localhost:9090/api/v1/query?query=${metric}" | jq -r '.data.result | length')
        
        if [[ "$query_result" -gt 0 ]]; then
            log_success "SLO metric '$metric' is available"
        else
            log_warning "SLO metric '$metric' has no data (may need time to collect)"
            metrics_available=false
        fi
    done
    
    # Check performance baseline metrics
    local perf_metrics=("perf:http_request_duration_95p" "perf:http_error_rate")
    
    for metric in "${perf_metrics[@]}"; do
        local query_result=$(curl -s "http://localhost:9090/api/v1/query?query=${metric}" | jq -r '.data.result | length')
        
        if [[ "$query_result" -gt 0 ]]; then
            log_success "Performance metric '$metric' is available"
        else
            log_warning "Performance metric '$metric' has no data"
            metrics_available=false
        fi
    done
    
    kill $pf_pid &>/dev/null || true
    
    if $metrics_available; then
        log_success "All SLO metrics are collecting data"
    else
        log_warning "Some metrics need more time to collect data"
    fi
}

# Function to check Grafana dashboards
check_grafana_dashboards() {
    log_info "Checking Grafana dashboards..."
    
    # Port forward to Grafana
    kubectl port-forward -n "$NAMESPACE" svc/prometheus-stack-grafana 3000:80 &>/dev/null &
    local pf_pid=$!
    sleep 3
    
    # Check if Grafana is accessible (admin:admin123 from monitoring-apps.yaml)
    local grafana_status=$(curl -s -u admin:admin123 http://localhost:3000/api/health | jq -r '.database')
    
    if [[ "$grafana_status" == "ok" ]]; then
        log_success "Grafana is accessible and healthy"
        
        # Check for our custom dashboards
        local dashboards=$(curl -s -u admin:admin123 http://localhost:3000/api/search?type=dash-db | jq -r '.[].title' | grep -i "performance\|slo\|cost" | wc -l)
        
        if [[ "$dashboards" -gt 0 ]]; then
            log_success "Custom SLO/Performance dashboards are available ($dashboards found)"
        else
            log_warning "Custom dashboards may not be loaded yet"
        fi
    else
        log_error "Grafana is not accessible or unhealthy"
    fi
    
    kill $pf_pid &>/dev/null || true
}

# Function to check AlertManager
check_alertmanager() {
    log_info "Checking AlertManager..."
    
    if kubectl get deployment alertmanager-prometheus-stack-kube-prom-alertmanager -n "$NAMESPACE" &>/dev/null; then
        local ready_replicas=$(kubectl get deployment alertmanager-prometheus-stack-kube-prom-alertmanager -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        local desired_replicas=$(kubectl get deployment alertmanager-prometheus-stack-kube-prom-alertmanager -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        
        if [[ "$ready_replicas" == "$desired_replicas" ]]; then
            log_success "AlertManager: $ready_replicas/$desired_replicas replicas ready"
        else
            log_warning "AlertManager: $ready_replicas/$desired_replicas replicas ready"
        fi
    else
        log_error "AlertManager deployment not found"
    fi
}

# Function to test SLO alert conditions
test_slo_alerts() {
    log_info "Testing SLO alert conditions..."
    
    # Port forward to Prometheus
    kubectl port-forward -n "$NAMESPACE" svc/prometheus-stack-kube-prom-prometheus 9090:9090 &>/dev/null &
    local pf_pid=$!
    sleep 3
    
    # Check if SLO violation alerts are configured
    local alerts=$(curl -s "http://localhost:9090/api/v1/rules" | jq -r '.data.groups[].rules[] | select(.type == "alerting" and (.alert | test("SLO|Availability|Latency"))) | .alert' | wc -l)
    
    if [[ "$alerts" -gt 0 ]]; then
        log_success "SLO alerting rules are configured ($alerts rules found)"
    else
        log_warning "SLO alerting rules may not be loaded yet"
    fi
    
    # Check current alert status
    local firing_alerts=$(curl -s "http://localhost:9090/api/v1/alerts" | jq -r '.data.alerts[] | select(.state == "firing") | .labels.alertname' | wc -l)
    
    if [[ "$firing_alerts" -eq 0 ]]; then
        log_success "No SLO alerts currently firing (system healthy)"
    else
        log_warning "$firing_alerts alerts currently firing (check AlertManager)"
    fi
    
    kill $pf_pid &>/dev/null || true
}

# Function to check service monitors
check_service_monitors() {
    log_info "Checking ServiceMonitors for Link services..."
    
    local services=("api-gateway" "user-svc" "chat-svc" "discovery-svc" "ai-svc" "search-svc" "feature-svc")
    local monitors_found=0
    
    for service in "${services[@]}"; do
        if kubectl get servicemonitor "$service" -n "$SERVICES_NAMESPACE" &>/dev/null; then
            log_success "ServiceMonitor for '$service' exists"
            ((monitors_found++))
        else
            log_warning "ServiceMonitor for '$service' not found"
        fi
    done
    
    if [[ "$monitors_found" -gt 0 ]]; then
        log_success "$monitors_found/$((${#services[@]})) ServiceMonitors found"
    else
        log_error "No ServiceMonitors found for Link services"
    fi
}

# Function to generate summary report
generate_summary() {
    log_info "==================================="
    log_info "SLO MONITORING DEPLOYMENT SUMMARY"
    log_info "==================================="
    echo
    log_info "✅ Components that should be working:"
    echo "   - Prometheus Stack (metrics collection)"
    echo "   - Grafana (dashboards and visualization)"
    echo "   - AlertManager (alert routing)"
    echo "   - SLO Prometheus Rules (SLI/SLO calculations)"
    echo "   - Performance Baseline Rules (performance monitoring)"
    echo "   - Cost Optimization Alerts (cost monitoring)"
    echo
    log_info "🚀 Next steps after validation:"
    echo "   1. Access Grafana: kubectl port-forward -n monitoring svc/prometheus-stack-grafana 3000:80"
    echo "   2. View dashboards at: http://localhost:3000 (admin/admin123)"
    echo "   3. Check Prometheus: kubectl port-forward -n monitoring svc/prometheus-stack-kube-prom-prometheus 9090:9090"
    echo "   4. Monitor alerts: kubectl port-forward -n monitoring svc/alertmanager-operated 9093:9093"
    echo
    log_info "📊 Available dashboards:"
    echo "   - Performance Baseline Monitoring"
    echo "   - Cost Optimization Analysis"
    echo "   - SLO Overview"
    echo "   - Database Performance"
    echo "   - Frontend User Experience"
    echo
    log_info "🎯 SLO Targets:"
    echo "   - Availability: ≥99.9% (7-day rolling)"
    echo "   - Latency: ≥95% requests <500ms (7-day rolling)"
    echo "   - Error Rate: ≤1% (5xx responses)"
    echo
    log_warning "⏰ Note: Metrics may take 5-10 minutes to start appearing after deployment"
}

# Main execution
main() {
    log_info "🎯 SLO Monitoring Deployment Validator"
    log_info "======================================"
    echo
    
    # Run all checks
    check_kubectl
    echo
    check_argocd_apps
    echo
    check_prometheus  
    echo
    check_slo_rules
    echo
    check_slo_metrics
    echo
    check_grafana_dashboards
    echo
    check_alertmanager
    echo
    check_service_monitors
    echo
    test_slo_alerts
    echo
    generate_summary
}

# Execute main function
main "$@"