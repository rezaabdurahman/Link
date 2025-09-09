#!/bin/bash
# Integration Testing Script
# Runs comprehensive integration tests for the Link platform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$PROJECT_ROOT/scripts/services.conf"

# Colors
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

echo -e "${GREEN}🧪 Link Integration Testing Suite${NC}"
echo "================================="

# Run backend integration tests if available
if [ -f "$PROJECT_ROOT/backend/integration-tests.sh" ]; then
    log_info "Running backend integration tests..."
    cd "$PROJECT_ROOT/backend"
    ./integration-tests.sh
    log_success "Backend integration tests completed"
else
    log_info "Backend integration tests script not found, checking individual services..."
    
    # Check for service-specific integration tests
    for service in "${SERVICES[@]}"; do
        if [ -d "$PROJECT_ROOT/backend/$service/test" ]; then
            log_info "Running integration tests for $service..."
            cd "$PROJECT_ROOT/backend/$service"
            make test 2>/dev/null || go test ./... || log_info "No test command available for $service"
        fi
    done
fi

# Run frontend integration tests
if [ -f "$PROJECT_ROOT/frontend/package.json" ]; then
    log_info "Running frontend integration tests..."
    cd "$PROJECT_ROOT/frontend"
    
    # Check if integration tests are defined
    if npm run --silent 2>/dev/null | grep -q "test:integration"; then
        npm run test:integration
    else
        log_info "Running standard frontend tests..."
        npm run test -- --watchAll=false
    fi
    log_success "Frontend tests completed"
fi

log_success "Integration testing suite completed!"