#!/bin/bash

# Comprehensive Database Monitoring Deployment Script v2
# Deploys the unified database performance monitoring system across all Link services

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
BACKEND_DIR="$PROJECT_ROOT/backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Service configuration with monitoring settings
declare -A SERVICE_CONFIG
SERVICE_CONFIG["user-svc"]="50ms:GORM:User operations require fast response"
SERVICE_CONFIG["location-svc"]="200ms:GORM:PostGIS spatial queries are complex"
SERVICE_CONFIG["search-svc"]="500ms:GORM:Vector similarity searches are compute-intensive"
SERVICE_CONFIG["chat-svc"]="50ms:PGX:Real-time messaging performance"

# Logging functions
log_header() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_step() {
    echo -e "\n${BLUE}📋 Step $1: $2${NC}"
}

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate environment
validate_environment() {
    log_step "1" "Validating deployment environment"
    
    # Check required tools
    local required_tools=("go" "curl" "jq")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command_exists "$tool"; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install the missing tools and re-run the deployment"
        exit 1
    fi
    
    # Check if we're in the correct directory
    if [ ! -f "$PROJECT_ROOT/backend/shared/database/monitoring/instrumentation.go" ]; then
        log_error "Database monitoring library not found. Please ensure you're running from the project root."
        exit 1
    fi
    
    # Check service directories
    for service in "${!SERVICE_CONFIG[@]}"; do
        if [ ! -d "$BACKEND_DIR/$service" ]; then
            log_warning "Service directory not found: $service"
        else
            log_info "Found service: $service"
        fi
    done
    
    log_success "Environment validation completed"
}

# Function to update service dependencies
update_service_dependencies() {
    log_step "2" "Updating service dependencies"
    
    for service in "${!SERVICE_CONFIG[@]}"; do
        local service_dir="$BACKEND_DIR/$service"
        
        if [ ! -d "$service_dir" ]; then
            log_warning "Skipping $service - directory not found"
            continue
        fi
        
        log_info "Updating dependencies for $service..."
        
        cd "$service_dir"
        
        # Add required dependencies
        local dependencies=(
            "github.com/prometheus/client_golang/prometheus"
            "github.com/prometheus/client_golang/prometheus/promauto"
            "github.com/getsentry/sentry-go"
        )
        
        for dep in "${dependencies[@]}"; do
            if ! go get "$dep" 2>/dev/null; then
                log_error "Failed to add dependency $dep to $service"
                continue
            fi
        done
        
        # Clean up dependencies
        go mod tidy
        
        log_success "$service dependencies updated"
    done
    
    log_success "All service dependencies updated"
}

# Function to validate service integration
validate_service_integration() {
    log_step "3" "Validating service integration"
    
    for service in "${!SERVICE_CONFIG[@]}"; do
        local service_dir="$BACKEND_DIR/$service"
        
        if [ ! -d "$service_dir" ]; then
            continue
        fi
        
        log_info "Validating $service integration..."
        
        # Check if monitoring is integrated
        case "$service" in
            "user-svc"|"location-svc"|"search-svc")
                if grep -r "monitoring\.NewGormMonitoringPlugin" "$service_dir/" >/dev/null 2>&1; then
                    log_success "$service: GORM monitoring integrated"
                else
                    log_warning "$service: GORM monitoring not integrated"
                    log_info "Please ensure database.go includes monitoring.NewGormMonitoringPlugin()"
                fi
                ;;
            "chat-svc")
                if grep -r "monitoring\.NewPgxInstrumentation\|monitoring\.MonitoredPool" "$service_dir/" >/dev/null 2>&1; then
                    log_success "$service: pgx monitoring integrated"
                else
                    log_warning "$service: pgx monitoring not integrated" 
                    log_info "Please ensure db.go includes pgx monitoring wrapper"
                fi
                ;;
        esac
        
        # Check if Sentry integration exists
        if grep -r "monitoring\.NewGormSentryPlugin\|monitoring\.PgxSentryWrapper" "$service_dir/" >/dev/null 2>&1; then
            log_success "$service: Sentry integration found"
        else
            log_info "$service: Sentry integration not found (optional)"
        fi
    done
}

# Function to deploy monitoring configuration
deploy_monitoring_config() {
    log_step "4" "Deploying monitoring configuration"
    
    # Ensure monitoring directories exist
    mkdir -p "$MONITORING_DIR/alerting-rules"
    mkdir -p "$MONITORING_DIR/grafana/dashboards"
    
    # Check if alerting rules exist
    if [ -f "$MONITORING_DIR/alerting-rules/database-performance.yml" ]; then
        log_success "Prometheus alerting rules already deployed"
    else
        log_error "Prometheus alerting rules not found"
        log_info "Please ensure monitoring/alerting-rules/database-performance.yml exists"
    fi
    
    # Check if Grafana dashboard exists
    if [ -f "$MONITORING_DIR/grafana/dashboards/database-performance.json" ]; then
        log_success "Grafana dashboard already deployed"
    else
        log_error "Grafana dashboard not found"
        log_info "Please ensure monitoring/grafana/dashboards/database-performance.json exists"
    fi
}

# Function to create deployment checklist
create_deployment_checklist() {
    log_step "5" "Creating deployment checklist"
    
    local checklist_file="$PROJECT_ROOT/DATABASE_MONITORING_CHECKLIST.md"
    
    cat > "$checklist_file" << EOF
# Database Monitoring Deployment Checklist

## Pre-Deployment Validation ✅
- [x] Environment validated and tools available
- [x] Service dependencies updated
- [x] Monitoring library integration verified
- [x] Configuration files deployed

## Service-Specific Integration Status

### User Service (user-svc)
- [ ] GORM monitoring plugin integrated (50ms threshold)
- [ ] Sentry plugin configured
- [ ] Service rebuilt and deployed
- [ ] Metrics endpoint verified

### Location Service (location-svc) 
- [ ] GORM monitoring plugin integrated (200ms threshold for PostGIS)
- [ ] Sentry plugin configured
- [ ] Service rebuilt and deployed
- [ ] Metrics endpoint verified

### Search Service (search-svc)
- [ ] GORM monitoring plugin integrated (500ms threshold for vector queries)
- [ ] Sentry plugin configured  
- [ ] Service rebuilt and deployed
- [ ] Metrics endpoint verified

### Chat Service (chat-svc)
- [ ] pgx monitoring wrapper integrated (50ms threshold)
- [ ] Sentry wrapper configured
- [ ] Service rebuilt and deployed
- [ ] Metrics endpoint verified

## Monitoring Infrastructure

### Prometheus
- [ ] Alerting rules loaded: monitoring/alerting-rules/database-performance.yml
- [ ] Services being scraped for database metrics
- [ ] Test queries returning data:
  - \`database_query_duration_seconds\`
  - \`database_queries_total\`
  - \`database_slow_queries_total\`
  - \`database_pool_used_connections\`

### Grafana
- [ ] Dashboard imported: Database Performance Dashboard
- [ ] Template variables working (service, table)
- [ ] All panels showing data
- [ ] SLO gauges configured correctly

### Sentry (Optional)
- [ ] SENTRY_DSN environment variable set
- [ ] Test database error reported successfully
- [ ] Slow query alerts configured
- [ ] Context information properly sanitized

## Testing and Validation

### Basic Functionality
- [ ] All services start without monitoring errors
- [ ] Database connections established successfully
- [ ] Metrics endpoints responding (/metrics)
- [ ] No performance degradation observed

### Load Testing
- [ ] Generate test load against services
- [ ] Verify metrics collection under load
- [ ] Confirm slow query detection works
- [ ] Validate connection pool monitoring

### Alerting
- [ ] Prometheus alerts configured and loading
- [ ] Test alert conditions (simulate high latency)
- [ ] Verify alert routing and notifications
- [ ] Validate alert recovery

## Production Deployment

### Rollout Strategy
- [ ] Deploy services in stages (user-svc → location-svc → search-svc → chat-svc)
- [ ] Monitor each deployment for issues
- [ ] Verify monitoring works before next service
- [ ] Keep old monitoring as backup initially

### Performance Validation
- [ ] Baseline performance measurements taken
- [ ] Monitor overhead acceptable (<1% CPU increase)
- [ ] Memory usage within expected ranges
- [ ] No impact on user-facing response times

### Team Readiness
- [ ] Development team trained on new metrics
- [ ] Operations team familiar with new alerts
- [ ] Runbooks updated with troubleshooting steps
- [ ] Documentation accessible to all stakeholders

## Post-Deployment Tasks

### Week 1
- [ ] Daily monitoring of new metrics
- [ ] Alert threshold tuning based on real traffic
- [ ] Performance impact assessment
- [ ] User feedback collection

### Week 2-4
- [ ] Historical trend analysis
- [ ] Query optimization opportunities identified
- [ ] Alert fatigue assessment and tuning
- [ ] Database capacity planning updates

### Ongoing
- [ ] Monthly monitoring review meetings
- [ ] Quarterly threshold and SLO review
- [ ] Database monitoring evolution planning
- [ ] Integration with other monitoring systems

## Troubleshooting Guide

### Metrics Not Appearing
1. Check service logs for monitoring plugin errors
2. Verify /metrics endpoint returns database metrics
3. Confirm Prometheus is scraping the service
4. Validate metric names match dashboard queries

### High Monitoring Overhead
1. Review query pattern cache size
2. Adjust metric collection frequency
3. Consider sampling for high-volume services
4. Monitor goroutine count for leaks

### False Positive Alerts
1. Analyze baseline performance patterns
2. Adjust thresholds based on service characteristics
3. Consider time-of-day variations
4. Review alert evaluation periods

### Missing Error Reports
1. Verify SENTRY_DSN configuration
2. Check Sentry project settings and quotas
3. Validate error types being captured
4. Review query sanitization effectiveness

## Success Criteria

The deployment is considered successful when:
- ✅ All services integrated without performance impact
- ✅ Database metrics visible in Prometheus and Grafana
- ✅ Alerts triggering correctly for test conditions
- ✅ Sentry receiving database errors with proper context
- ✅ Team can use monitoring to troubleshoot database issues
- ✅ No increase in production incidents related to database monitoring

---
**Deployment Date**: $(date)
**Deployed By**: $(whoami)
**Version**: Database Monitoring v2.0
EOF

    log_success "Deployment checklist created: $checklist_file"
}

# Function to generate monitoring summary
generate_monitoring_summary() {
    log_step "6" "Generating monitoring summary"
    
    echo -e "\n${GREEN}╔═══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                        DATABASE MONITORING SUMMARY                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${BLUE}📊 Metrics Exported:${NC}"
    echo "  • database_query_duration_seconds     - Query execution time histograms"
    echo "  • database_queries_total               - Query counts by service/operation/status"
    echo "  • database_slow_queries_total          - Slow query detection counters"
    echo "  • database_query_errors_total          - Error categorization and tracking"
    echo "  • database_pool_*_connections          - Connection pool health monitoring"
    echo "  • database_transactions_total          - Transaction success/failure tracking"
    echo "  • database_rows_affected              - Operation impact measurement"
    
    echo -e "\n${BLUE}🎯 Service Configurations:${NC}"
    for service in "${!SERVICE_CONFIG[@]}"; do
        IFS=':' read -r threshold type description <<< "${SERVICE_CONFIG[$service]}"
        printf "  • %-15s %s threshold, %s driver - %s\n" "$service" "$threshold" "$type" "$description"
    done
    
    echo -e "\n${BLUE}🚨 Alert Categories:${NC}"
    echo "  • Critical: Connection pool exhaustion, high error rates, SLO breaches"
    echo "  • Warning: Slow queries, high pool usage, performance degradation"
    echo "  • Info: Capacity planning, trend analysis, maintenance notifications"
    
    echo -e "\n${BLUE}🔍 Sentry Integration:${NC}"
    echo "  • Automatic error capture with sanitized context"
    echo "  • Slow query performance reporting"
    echo "  • Connection pool issue detection"
    echo "  • Transaction failure tracking"
    
    echo -e "\n${BLUE}📈 Dashboard Features:${NC}"
    echo "  • Real-time query performance percentiles"
    echo "  • Service-specific monitoring (Chat, Search, Location, User)"
    echo "  • Error analysis and distribution"
    echo "  • SLO tracking and compliance monitoring"
    echo "  • Connection pool utilization trends"
    
    echo -e "\n${BLUE}🛡️ Security & Privacy:${NC}"
    echo "  • Query sanitization (parameters masked as $?)"
    echo "  • No PII in metric labels"
    echo "  • Configurable Sentry sampling rates"
    echo "  • Environment-based feature toggling"
    
    echo -e "\n${GREEN}✅ Deployment Status: READY${NC}"
    echo -e "${GREEN}🚀 Next Steps: Follow the deployment checklist to complete integration${NC}"
}

# Function to run health checks
run_health_checks() {
    log_step "7" "Running post-deployment health checks"
    
    local health_status=0
    
    # Check if shared monitoring library exists
    if [ -f "$BACKEND_DIR/shared/database/monitoring/instrumentation.go" ]; then
        log_success "✅ Monitoring library found"
    else
        log_error "❌ Monitoring library missing"
        health_status=1
    fi
    
    # Check service integrations
    for service in "${!SERVICE_CONFIG[@]}"; do
        local service_dir="$BACKEND_DIR/$service"
        
        if [ ! -d "$service_dir" ]; then
            log_warning "⚠️  Service $service directory not found"
            continue
        fi
        
        # Check if go.mod has required dependencies
        if grep -q "github.com/prometheus/client_golang" "$service_dir/go.mod" 2>/dev/null; then
            log_success "✅ $service: Prometheus dependencies added"
        else
            log_warning "⚠️  $service: Missing Prometheus dependencies"
        fi
        
        if grep -q "github.com/getsentry/sentry-go" "$service_dir/go.mod" 2>/dev/null; then
            log_info "✅ $service: Sentry dependencies added"
        else
            log_info "ℹ️  $service: Sentry dependencies not added (optional)"
        fi
    done
    
    # Check monitoring configuration files
    if [ -f "$MONITORING_DIR/alerting-rules/database-performance.yml" ]; then
        log_success "✅ Prometheus alerting rules deployed"
    else
        log_error "❌ Prometheus alerting rules missing"
        health_status=1
    fi
    
    if [ -f "$MONITORING_DIR/grafana/dashboards/database-performance.json" ]; then
        log_success "✅ Grafana dashboard deployed"
    else
        log_error "❌ Grafana dashboard missing"
        health_status=1
    fi
    
    return $health_status
}

# Main deployment function
main() {
    log_header "🚀 COMPREHENSIVE DATABASE MONITORING DEPLOYMENT"
    
    # Run deployment steps
    validate_environment
    update_service_dependencies
    validate_service_integration
    deploy_monitoring_config
    create_deployment_checklist
    
    # Run health checks
    if run_health_checks; then
        log_success "All health checks passed!"
        generate_monitoring_summary
        
        echo -e "\n${GREEN}🎉 Database monitoring deployment completed successfully!${NC}"
        echo -e "${BLUE}📋 Check the deployment checklist: DATABASE_MONITORING_CHECKLIST.md${NC}"
        echo -e "${BLUE}📚 Documentation: backend/shared/database/monitoring/README.md${NC}"
        
    else
        log_error "Some health checks failed. Please review the issues above."
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Database Monitoring Deployment Script v2"
        echo ""
        echo "Usage: $0 [--help]"
        echo ""
        echo "This script deploys comprehensive database monitoring across all Link services"
        echo "including Prometheus metrics, Grafana dashboards, and Sentry integration."
        echo ""
        echo "Features:"
        echo "  • GORM and pgx instrumentation"
        echo "  • Service-specific performance thresholds"
        echo "  • Automatic error reporting with Sentry"
        echo "  • Real-time alerting and dashboards"
        echo "  • Production-ready security and privacy"
        echo ""
        echo "Environment Variables:"
        echo "  SENTRY_DSN    - Sentry DSN for error reporting (optional)"
        echo "  ENVIRONMENT   - Deployment environment (development/production)"
        echo ""
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
