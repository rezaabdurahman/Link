#!/bin/bash
# Smoke Testing Script
# Quick smoke tests to verify basic functionality

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$PROJECT_ROOT/scripts/services.conf"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${GREEN}💨 Link Smoke Testing Suite${NC}"
echo "============================="

failures=0

# Test service health endpoints
log_info "Testing service health endpoints..."
for service in "${SERVICES[@]}"; do
    port=$(get_service_port "$service")
    health_endpoint=$(get_health_endpoint "$service")
    url="http://localhost:${port}${health_endpoint}"
    
    # Try up to 3 times with 5 second timeout each
    local attempts=3
    local success=false
    
    for ((i=1; i<=attempts; i++)); do
        if curl --connect-timeout 5 --max-time 10 -sf "$url" >/dev/null 2>&1; then
            success=true
            break
        fi
        [ $i -lt $attempts ] && sleep 2
    done
    
    if [ "$success" = true ]; then
        log_success "$service health check passed"
    else
        log_error "$service health check failed after $attempts attempts ($url)"
        failures=$((failures + 1))
    fi
done

# Test API Gateway
log_info "Testing API Gateway..."
if curl --connect-timeout 5 --max-time 10 -sf "http://localhost:8080/health" >/dev/null 2>&1; then
    log_success "API Gateway health check passed"
else
    log_error "API Gateway health check failed"
    failures=$((failures + 1))
fi

# Test frontend if running
log_info "Testing frontend availability..."
if curl --connect-timeout 5 --max-time 10 -sf "http://localhost:3000" >/dev/null 2>&1; then
    log_success "Frontend is accessible"
else
    log_error "Frontend not accessible"
    failures=$((failures + 1))
fi

# Test database connectivity
log_info "Testing database connectivity..."
if docker-compose -f "$PROJECT_ROOT/backend/docker-compose.yml" exec -T postgres pg_isready >/dev/null 2>&1; then
    log_success "Database connectivity verified"
else
    log_error "Database connectivity failed"
    failures=$((failures + 1))
fi

# Test Redis connectivity
log_info "Testing Redis connectivity..."
if docker-compose -f "$PROJECT_ROOT/backend/docker-compose.yml" exec -T redis redis-cli ping | grep -q PONG; then
    log_success "Redis connectivity verified"
else
    log_error "Redis connectivity failed"
    failures=$((failures + 1))
fi

# Run monitoring smoke test if available
if [ -f "$PROJECT_ROOT/scripts/smoke-test-monitoring.sh" ]; then
    log_info "Running monitoring smoke tests..."
    ./smoke-test-monitoring.sh --quick
fi

echo ""
echo "==============================="
if [ $failures -eq 0 ]; then
    log_success "All smoke tests passed! ✅"
    exit 0
else
    log_error "$failures smoke test(s) failed ❌"
    exit 1
fi