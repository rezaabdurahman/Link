#!/bin/bash
# Performance Testing Script
# Runs performance benchmarks for the Link platform

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

echo -e "${GREEN}⚡ Link Performance Testing Suite${NC}"
echo "================================="

# Run enhanced performance test if available
if [ -f "$PROJECT_ROOT/backend/enhanced_performance_test.sh" ]; then
    log_info "Running enhanced performance tests..."
    cd "$PROJECT_ROOT/backend"
    ./enhanced_performance_test.sh
    log_success "Enhanced performance tests completed"
fi

# Run performance baseline analyzer
if [ -f "$PROJECT_ROOT/scripts/performance-baseline-analyzer.sh" ]; then
    log_info "Running performance baseline analysis..."
    ./performance-baseline-analyzer.sh
    log_success "Performance baseline analysis completed"
fi

# Run load tests if available
if [ -f "$PROJECT_ROOT/tests/load/run-load-tests.sh" ]; then
    log_info "Running load tests..."
    cd "$PROJECT_ROOT/tests/load"
    ./run-load-tests.sh
    log_success "Load tests completed"
fi

log_success "Performance testing suite completed!"