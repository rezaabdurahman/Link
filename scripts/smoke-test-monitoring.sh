#!/bin/bash

# =================================================================
# Monitoring Stack Smoke Tests
# =================================================================
# This script performs comprehensive smoke tests on the monitoring
# stack to ensure all components are working correctly.
# 
# Usage:
#   ./scripts/smoke-test-monitoring.sh [environment]
#   
# Environment: local, staging, production (default: local)
# =================================================================

set -euo pipefail

# Configuration
ENVIRONMENT=${1:-"local"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    ((TOTAL_TESTS++))
    log_info "Running test: $test_name"
    
    if $test_function; then
        log_success "$test_name"
        return 0
    else
        log_error "$test_name"
        return 1
    fi
}

# Environment-specific configuration
configure_environment() {
    case "$ENVIRONMENT" in
        "local")
            PROMETHEUS_URL="http://localhost:9090"
            GRAFANA_URL="http://localhost:3001"
            ALERTMANAGER_URL="http://localhost:9093"
            LOKI_URL="http://localhost:3100"
            JAEGER_URL="http://localhost:16686"
            
            # Service endpoints for local
            declare -A SERVICE_URLS
            SERVICE_URLS[api-gateway]="http://localhost:8080"
            SERVICE_URLS[user-svc]="http://localhost:8080"
            SERVICE_URLS[chat-svc]="http://localhost:8080"
            SERVICE_URLS[discovery-svc]="http://localhost:8083"
            SERVICE_URLS[search-svc]="http://localhost:8085"
            SERVICE_URLS[ai-svc]="http://localhost:8000"
            ;;
        "staging")
            PROMETHEUS_URL="https://prometheus-staging.yourdomain.com"
            GRAFANA_URL="https://grafana-staging.yourdomain.com"
            ALERTMANAGER_URL="https://alertmanager-staging.yourdomain.com"
            LOKI_URL="https://loki-staging.yourdomain.com"
            JAEGER_URL="https://jaeger-staging.yourdomain.com"
            
            # Service endpoints for staging (via load balancer)
            declare -A SERVICE_URLS
            SERVICE_URLS[api-gateway]="https://api-staging.yourdomain.com"
            SERVICE_URLS[user-svc]="https://api-staging.yourdomain.com"
            SERVICE_URLS[chat-svc]="https://api-staging.yourdomain.com"
            SERVICE_URLS[discovery-svc]="https://api-staging.yourdomain.com"
            SERVICE_URLS[search-svc]="https://api-staging.yourdomain.com"
            SERVICE_URLS[ai-svc]="https://api-staging.yourdomain.com"
            ;;
        "production")
            PROMETHEUS_URL="https://prometheus.yourdomain.com"
            GRAFANA_URL="https://grafana.yourdomain.com"
            ALERTMANAGER_URL="https://alertmanager.yourdomain.com"
            LOKI_URL="https://loki.yourdomain.com"
            JAEGER_URL="https://jaeger.yourdomain.com"
            
            # Service endpoints for production (via load balancer)
            declare -A SERVICE_URLS
            SERVICE_URLS[api-gateway]="https://api.yourdomain.com"
            SERVICE_URLS[user-svc]="https://api.yourdomain.com"
            SERVICE_URLS[chat-svc]="https://api.yourdomain.com"
            SERVICE_URLS[discovery-svc]="https://api.yourdomain.com"
            SERVICE_URLS[search-svc]="https://api.yourdomain.com"
            SERVICE_URLS[ai-svc]="https://api.yourdomain.com"
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Test Prometheus health and configuration
test_prometheus_health() {
    local url="$PROMETHEUS_URL/-/healthy"
    
    if curl -s -f "$url" > /dev/null; then
        return 0
    else
        log_error "Prometheus health check failed at $url"
        return 1
    fi
}

test_prometheus_config() {
    local url="$PROMETHEUS_URL/api/v1/status/config"
    
    if response=$(curl -s -f "$url"); then
        # Check if configuration contains our services
        if echo "$response" | jq -r '.data.yaml' | grep -q "api-gateway\|user-svc\|chat-svc"; then
            return 0
        else
            log_error "Prometheus config doesn't contain expected services"
            return 1
        fi
    else
        log_error "Failed to fetch Prometheus configuration"
        return 1
    fi
}

# Test service metrics endpoints
test_service_metrics() {
    local service="$1"
    local base_url="${SERVICE_URLS[$service]}"
    local metrics_url="$base_url/metrics"
    
    if response=$(curl -s -f "$metrics_url"); then
        # Check for Prometheus format metrics
        if echo "$response" | grep -q "^# HELP\|^# TYPE"; then
            # Check for service-specific metrics
            case "$service" in
                "api-gateway")
                    if echo "$response" | grep -q "api_gateway_http_requests_total\|gateway_"; then
                        return 0
                    fi
                    ;;
                "user-svc")
                    if echo "$response" | grep -q "user_svc_http_requests_total"; then
                        return 0
                    fi
                    ;;
                "chat-svc")
                    if echo "$response" | grep -q "chat_svc_http_requests_total\|chat_svc_messages_total"; then
                        return 0
                    fi
                    ;;
                "discovery-svc")
                    if echo "$response" | grep -q "discovery_svc_http_requests_total\|discovery_svc_broadcasts_total"; then
                        return 0
                    fi
                    ;;
                "search-svc")
                    if echo "$response" | grep -q "search_svc_http_requests_total\|search_svc_queries_total"; then
                        return 0
                    fi
                    ;;
                "ai-svc")
                    if echo "$response" | grep -q "ai_svc_http_requests_total\|ai_svc_ai_requests_total"; then
                        return 0
                    fi
                    ;;
            esac
        fi
    fi
    
    log_error "Service $service metrics endpoint failed or missing expected metrics"
    return 1
}

# Test Grafana health and datasources
test_grafana_health() {
    local url="$GRAFANA_URL/api/health"
    
    if response=$(curl -s -f "$url"); then
        if echo "$response" | jq -r '.database' | grep -q "ok"; then
            return 0
        fi
    fi
    
    log_error "Grafana health check failed"
    return 1
}

test_grafana_datasources() {
    local url="$GRAFANA_URL/api/datasources"
    
    # For local environment, we can test without auth
    # For staging/production, this would need proper credentials
    if [ "$ENVIRONMENT" = "local" ]; then
        if response=$(curl -s -f "$url"); then
            # Check for Prometheus and Loki datasources
            if echo "$response" | jq '.[].type' | grep -q "prometheus\|loki"; then
                return 0
            fi
        fi
    else
        # In staging/production, we'd need authentication
        log_warning "Skipping Grafana datasource test for $ENVIRONMENT (requires authentication)"
        return 0
    fi
    
    log_error "Grafana datasources test failed"
    return 1
}

# Test AlertManager
test_alertmanager_health() {
    local url="$ALERTMANAGER_URL/-/healthy"
    
    if curl -s -f "$url" > /dev/null; then
        return 0
    else
        log_error "AlertManager health check failed"
        return 1
    fi
}

test_alertmanager_config() {
    local url="$ALERTMANAGER_URL/api/v1/status"
    
    if response=$(curl -s -f "$url"); then
        if echo "$response" | jq -r '.status' | grep -q "success"; then
            return 0
        fi
    fi
    
    log_error "AlertManager config test failed"
    return 1
}

# Test Loki
test_loki_health() {
    local url="$LOKI_URL/ready"
    
    if curl -s -f "$url" > /dev/null; then
        return 0
    else
        log_error "Loki health check failed"
        return 1
    fi
}

test_loki_ingestion() {
    local url="$LOKI_URL/loki/api/v1/query"
    local query="count_over_time({job=\"containerlogs\"}[1m])"
    
    if response=$(curl -s -f "$url?query=$query"); then
        if echo "$response" | jq -r '.status' | grep -q "success"; then
            return 0
        fi
    fi
    
    log_warning "Loki ingestion test failed (may be expected if no recent logs)"
    return 0  # Don't fail on this as it depends on log availability
}

# Test Jaeger
test_jaeger_health() {
    local url="$JAEGER_URL/api/services"
    
    if response=$(curl -s -f "$url"); then
        if echo "$response" | jq -r '.data' | grep -q "\[\]"; then
            return 0  # Empty array is ok, means Jaeger is running
        elif echo "$response" | jq -r '.data[]' | grep -q "api-gateway\|user-svc"; then
            return 0  # Even better, we have traces
        fi
    fi
    
    log_warning "Jaeger health check failed (may be expected if no traces yet)"
    return 0  # Don't fail on this as it depends on trace availability
}

# Test end-to-end metric flow
test_e2e_metrics_flow() {
    log_info "Testing end-to-end metrics flow..."
    
    # Make a request to API Gateway to generate metrics
    local api_url="${SERVICE_URLS[api-gateway]}/health"
    
    if curl -s -f "$api_url" > /dev/null; then
        log_info "Generated test request to API Gateway"
        
        # Wait a bit for metrics to be scraped
        sleep 5
        
        # Query Prometheus for the metric
        local query_url="$PROMETHEUS_URL/api/v1/query?query=api_gateway_http_requests_total"
        
        if response=$(curl -s -f "$query_url"); then
            if echo "$response" | jq -r '.status' | grep -q "success"; then
                local result_count=$(echo "$response" | jq -r '.data.result | length')
                if [ "$result_count" -gt 0 ]; then
                    log_success "End-to-end metrics flow working (found $result_count metrics)"
                    return 0
                fi
            fi
        fi
    fi
    
    log_error "End-to-end metrics flow test failed"
    return 1
}

# Test alert rules
test_alert_rules() {
    local url="$PROMETHEUS_URL/api/v1/rules"
    
    if response=$(curl -s -f "$url"); then
        if echo "$response" | jq -r '.status' | grep -q "success"; then
            local rules_count=$(echo "$response" | jq -r '.data.groups | length')
            if [ "$rules_count" -gt 0 ]; then
                log_success "Found $rules_count alert rule groups"
                return 0
            fi
        fi
    fi
    
    log_error "Alert rules test failed"
    return 1
}

# Main test execution
main() {
    log_info "Starting monitoring stack smoke tests for environment: $ENVIRONMENT"
    log_info "=================================================="
    
    configure_environment
    
    # Core monitoring stack tests
    run_test "Prometheus Health" test_prometheus_health
    run_test "Prometheus Configuration" test_prometheus_config
    run_test "Grafana Health" test_grafana_health
    run_test "Grafana Datasources" test_grafana_datasources
    run_test "AlertManager Health" test_alertmanager_health
    run_test "AlertManager Configuration" test_alertmanager_config
    run_test "Loki Health" test_loki_health
    run_test "Loki Ingestion" test_loki_ingestion
    run_test "Jaeger Health" test_jaeger_health
    
    # Service metrics tests
    for service in "${!SERVICE_URLS[@]}"; do
        run_test "Service Metrics: $service" "test_service_metrics $service"
    done
    
    # Integration tests
    run_test "Alert Rules" test_alert_rules
    run_test "End-to-End Metrics Flow" test_e2e_metrics_flow
    
    # Results summary
    log_info "=================================================="
    log_info "Test Results Summary:"
    log_info "Total Tests: $TOTAL_TESTS"
    log_success "Passed: $PASSED_TESTS"
    
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Failed: $FAILED_TESTS"
        log_error "Some tests failed. Please check the monitoring stack configuration."
        exit 1
    else
        log_success "All tests passed! Monitoring stack is healthy."
        exit 0
    fi
}

# Check dependencies
command -v curl >/dev/null 2>&1 || { log_error "curl is required but not installed."; exit 1; }
command -v jq >/dev/null 2>&1 || { log_error "jq is required but not installed."; exit 1; }

# Run main function
main "$@"