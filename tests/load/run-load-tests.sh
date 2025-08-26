#!/bin/bash

# Load Testing Execution Script
# Runs comprehensive load tests for all critical user journeys
# Usage: ./tests/load/run-load-tests.sh [scenario] [environment]

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Default values
SCENARIO="${1:-load}"
ENVIRONMENT="${2:-development}"
OUTPUT_DIR="$PROJECT_ROOT/reports/load-tests"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Environment configurations
declare -A ENV_CONFIGS
ENV_CONFIGS[development]="BASE_URL=http://localhost:8080 FRONTEND_URL=http://localhost:3000"
ENV_CONFIGS[staging]="BASE_URL=https://api-staging.link-app.com FRONTEND_URL=https://staging.link-app.com"
ENV_CONFIGS[production]="BASE_URL=https://api.link-app.com FRONTEND_URL=https://link-app.com"

# Available scenarios
SCENARIOS=("smoke" "load" "stress" "spike" "baseline")

# Available test suites
declare -A TEST_SUITES
TEST_SUITES[basic]="basic-load-test.js"
TEST_SUITES[frontend]="frontend-load-test.js"
TEST_SUITES[comprehensive]="comprehensive-user-journeys.js"
TEST_SUITES[websocket]="websocket-chat-load-test.js"
TEST_SUITES[baseline]="performance-baseline-test.js"
TEST_SUITES[all]="comprehensive-user-journeys.js websocket-chat-load-test.js performance-baseline-test.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

usage() {
    echo "Usage: $0 [scenario] [environment] [test_suite]"
    echo ""
    echo "Available scenarios: ${SCENARIOS[*]}"
    echo "Available environments: ${!ENV_CONFIGS[*]}"
    echo "Available test suites: ${!TEST_SUITES[*]}"
    echo ""
    echo "Examples:"
    echo "  $0 smoke development comprehensive"
    echo "  $0 load staging all"
    echo "  $0 stress production websocket"
    echo "  $0 baseline production baseline"
}

check_dependencies() {
    log "Checking dependencies..."
    
    if ! command -v k6 &> /dev/null; then
        error "k6 is not installed. Install from: https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        warn "jq is not installed. JSON report parsing will be limited."
    fi
    
    log "Dependencies check passed"
}

validate_environment() {
    log "Validating environment: $ENVIRONMENT"
    
    if [[ ! "${!ENV_CONFIGS[*]}" =~ $ENVIRONMENT ]]; then
        error "Invalid environment: $ENVIRONMENT"
        usage
        exit 1
    fi
    
    # Extract URLs from environment config
    local env_config="${ENV_CONFIGS[$ENVIRONMENT]}"
    local base_url=$(echo "$env_config" | grep -o 'BASE_URL=[^ ]*' | cut -d'=' -f2)
    local frontend_url=$(echo "$env_config" | grep -o 'FRONTEND_URL=[^ ]*' | cut -d'=' -f2)
    
    info "Testing connectivity to $base_url"
    if ! curl -sf "$base_url/health" >/dev/null 2>&1; then
        warn "Cannot reach API at $base_url/health"
        warn "Continuing anyway - the test might fail if the service is not available"
    else
        log "API connectivity confirmed"
    fi
    
    if [[ "$frontend_url" != *"localhost"* ]]; then
        info "Testing connectivity to $frontend_url"
        if ! curl -sf "$frontend_url" >/dev/null 2>&1; then
            warn "Cannot reach frontend at $frontend_url"
            warn "Frontend tests might fail"
        else
            log "Frontend connectivity confirmed"
        fi
    fi
}

setup_output_directory() {
    log "Setting up output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
    
    # Create environment-specific subdirectory
    local env_output_dir="$OUTPUT_DIR/$ENVIRONMENT"
    mkdir -p "$env_output_dir"
    
    # Create timestamped subdirectory for this test run
    OUTPUT_DIR="$env_output_dir/${SCENARIO}_${TIMESTAMP}"
    mkdir -p "$OUTPUT_DIR"
    
    log "Test results will be saved to: $OUTPUT_DIR"
}

run_single_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .js)
    
    log "Running test: $test_name"
    
    # Prepare environment variables
    local env_vars="${ENV_CONFIGS[$ENVIRONMENT]} SCENARIO=$SCENARIO TARGET_ENV=$ENVIRONMENT"
    
    # Generate output files
    local json_output="$OUTPUT_DIR/${test_name}_results.json"
    local summary_output="$OUTPUT_DIR/${test_name}_summary.txt"
    local log_output="$OUTPUT_DIR/${test_name}_log.txt"
    
    # Run the test
    info "Executing: k6 run --env $env_vars $SCRIPT_DIR/$test_file"
    
    if env $env_vars k6 run \
        --summary-export="$json_output" \
        --console-output="$log_output" \
        "$SCRIPT_DIR/$test_file" 2>&1 | tee "$summary_output"; then
        
        log "✅ Test completed: $test_name"
        
        # Extract key metrics if jq is available
        if command -v jq &> /dev/null && [[ -f "$json_output" ]]; then
            extract_key_metrics "$json_output" "$test_name"
        fi
        
        return 0
    else
        error "❌ Test failed: $test_name"
        return 1
    fi
}

extract_key_metrics() {
    local json_file="$1"
    local test_name="$2"
    local metrics_file="$OUTPUT_DIR/${test_name}_metrics.txt"
    
    info "Extracting key metrics for $test_name"
    
    {
        echo "=== Key Metrics for $test_name ==="
        echo "Generated at: $(date)"
        echo ""
        
        # HTTP request metrics
        if jq -e '.metrics.http_req_duration' "$json_file" >/dev/null 2>&1; then
            echo "HTTP Request Duration:"
            jq -r '.metrics.http_req_duration | "  Average: \(.avg)ms\n  P95: \(.p95)ms\n  P99: \(.p99)ms"' "$json_file"
            echo ""
        fi
        
        # HTTP request failure rate
        if jq -e '.metrics.http_req_failed' "$json_file" >/dev/null 2>&1; then
            echo "HTTP Request Failure Rate:"
            jq -r '.metrics.http_req_failed.rate | "  \(. * 100)%"' "$json_file"
            echo ""
        fi
        
        # Custom SLO metrics
        if jq -e '.metrics.slo_api_availability' "$json_file" >/dev/null 2>&1; then
            echo "SLO Metrics:"
            jq -r '.metrics | to_entries[] | select(.key | startswith("slo_")) | "  \(.key): \(.value.rate // .value.avg // .value.p95 // "N/A")"' "$json_file"
            echo ""
        fi
        
        # Test-specific metrics
        if jq -e '.metrics.journey_success' "$json_file" >/dev/null 2>&1; then
            echo "Journey Success Rate:"
            jq -r '.metrics.journey_success.rate | "  \(. * 100)%"' "$json_file"
            echo ""
        fi
        
        # Iterations and data
        echo "Test Execution:"
        jq -r '"  Total Iterations: \(.metrics.iterations.count)\n  Total Duration: \(.state.testRunDurationMs)ms\n  Data Sent: \(.metrics.data_sent.count) bytes\n  Data Received: \(.metrics.data_received.count) bytes"' "$json_file"
        
    } > "$metrics_file"
    
    log "Key metrics saved to: $metrics_file"
}

generate_test_report() {
    local report_file="$OUTPUT_DIR/test_report.md"
    
    log "Generating comprehensive test report"
    
    cat > "$report_file" << EOF
# Load Test Report

## Test Configuration
- **Scenario**: $SCENARIO
- **Environment**: $ENVIRONMENT  
- **Timestamp**: $TIMESTAMP
- **Test Suite**: ${TEST_SUITE:-comprehensive}

## Environment Details
$(echo "${ENV_CONFIGS[$ENVIRONMENT]}" | tr ' ' '\n' | sed 's/^/- /')

## Test Results Summary

EOF

    # Add individual test results
    for result_file in "$OUTPUT_DIR"/*_summary.txt; do
        if [[ -f "$result_file" ]]; then
            local test_name=$(basename "$result_file" _summary.txt)
            echo "### $test_name" >> "$report_file"
            echo '```' >> "$report_file"
            tail -20 "$result_file" >> "$report_file"
            echo '```' >> "$report_file"
            echo "" >> "$report_file"
        fi
    done
    
    # Add key metrics summary
    cat >> "$report_file" << EOF

## Key Metrics Summary

EOF

    for metrics_file in "$OUTPUT_DIR"/*_metrics.txt; do
        if [[ -f "$metrics_file" ]]; then
            echo '```' >> "$report_file"
            cat "$metrics_file" >> "$report_file"
            echo '```' >> "$report_file"
            echo "" >> "$report_file"
        fi
    done
    
    # Add recommendations
    cat >> "$report_file" << EOF

## Recommendations

### Performance Optimization
- Monitor P95 response times and optimize slow endpoints
- Review error rates and investigate failure causes
- Consider horizontal scaling if throughput is insufficient

### SLO Compliance
- Ensure availability metrics meet target thresholds
- Track error budget consumption over time
- Set up automated alerting for SLO violations

### Next Steps
- Run tests regularly to catch performance regressions
- Implement performance budgets in CI/CD pipeline
- Set up continuous load testing for critical flows

---
*Report generated by Link Load Testing Suite*
*Generated at: $(date)*
EOF

    log "Test report generated: $report_file"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo "🚀 Link Load Testing Suite"
    echo "=========================="
    
    # Parse arguments
    local test_suite="${3:-comprehensive}"
    
    # Validate inputs
    if [[ ! " ${SCENARIOS[*]} " =~ " $SCENARIO " ]]; then
        error "Invalid scenario: $SCENARIO"
        usage
        exit 1
    fi
    
    if [[ ! "${!TEST_SUITES[*]}" =~ $test_suite ]]; then
        error "Invalid test suite: $test_suite"
        usage
        exit 1
    fi
    
    # Set global TEST_SUITE for reporting
    TEST_SUITE="$test_suite"
    
    # Setup
    check_dependencies
    validate_environment
    setup_output_directory
    
    log "Starting load tests with configuration:"
    info "  Scenario: $SCENARIO"
    info "  Environment: $ENVIRONMENT"
    info "  Test Suite: $test_suite"
    info "  Output Directory: $OUTPUT_DIR"
    
    # Get test files to run
    local test_files=(${TEST_SUITES[$test_suite]})
    local failed_tests=0
    local total_tests=${#test_files[@]}
    
    # Run tests
    log "Running $total_tests test(s)..."
    
    for test_file in "${test_files[@]}"; do
        if ! run_single_test "$test_file"; then
            ((failed_tests++))
        fi
        echo "" # Add spacing between tests
    done
    
    # Generate report
    generate_test_report
    
    # Final summary
    echo ""
    echo "🏁 Load Testing Complete"
    echo "======================"
    log "Total Tests: $total_tests"
    
    if [[ $failed_tests -eq 0 ]]; then
        log "✅ All tests passed"
    else
        warn "❌ $failed_tests test(s) failed out of $total_tests"
    fi
    
    log "Results available in: $OUTPUT_DIR"
    
    # Exit with error code if any tests failed
    exit $failed_tests
}

# Handle command line arguments
if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

# Run main function
main "$@"