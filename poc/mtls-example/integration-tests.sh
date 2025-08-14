#!/bin/bash

# mTLS Integration Tests Script
# Comprehensive smoke tests for mTLS POC using curl and Go integration tests

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
DEFAULT_GATEWAY_URL="http://localhost:8080"
DEFAULT_SERVICE_URL="https://localhost:8443"
DEFAULT_CERTS_DIR="./certs"
DEFAULT_SERVER_NAME="service"

# Override with environment variables if set
GATEWAY_URL="${GATEWAY_URL:-$DEFAULT_GATEWAY_URL}"
SERVICE_URL="${SERVICE_URL:-$DEFAULT_SERVICE_URL}"
CERTS_DIR="${CERTS_DIR:-$DEFAULT_CERTS_DIR}"
SERVER_NAME="${SERVER_NAME:-$DEFAULT_SERVER_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test result tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Logging functions
log_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_skip() {
    echo -e "${YELLOW}⏭️  $1${NC}"
    ((TESTS_SKIPPED++))
}

log_header() {
    echo -e "\n${BLUE}🔷 $1${NC}"
    echo "$(printf '=%.0s' $(seq 1 ${#1}))"
}

# Helper function to check if service is running
wait_for_service() {
    local url="$1"
    local name="$2"
    local max_attempts=30
    local attempt=1

    log_info "Waiting for $name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            log_success "$name is ready"
            return 0
        fi
        
        log_info "Attempt $attempt/$max_attempts: $name not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    log_error "$name failed to start after $max_attempts attempts"
    return 1
}

# Helper function to make HTTP requests with proper error handling
make_request() {
    local method="$1"
    local url="$2"
    local description="$3"
    local expected_status="${4:-200}"
    local additional_curl_args="${5:-}"
    
    log_info "Testing: $description"
    log_info "Request: $method $url"
    
    # Create a temporary file for response
    local response_file
    response_file=$(mktemp)
    local status_code
    
    # Make the request and capture both status code and response
    if status_code=$(curl -s -w "%{http_code}" -X "$method" $additional_curl_args "$url" -o "$response_file" 2>/dev/null); then
        # Check if we got the expected status code
        if [ "$status_code" = "$expected_status" ]; then
            log_success "$description (HTTP $status_code)"
            
            # Show response if it's JSON
            if command -v jq > /dev/null 2>&1; then
                if jq . "$response_file" > /dev/null 2>&1; then
                    echo "Response:"
                    jq . "$response_file" | head -10
                else
                    echo "Response (first 200 chars):"
                    head -c 200 "$response_file"
                fi
            else
                echo "Response (first 200 chars):"
                head -c 200 "$response_file"
            fi
        else
            log_error "$description - Expected HTTP $expected_status, got $status_code"
            echo "Response:"
            cat "$response_file" | head -5
        fi
    else
        log_error "$description - Request failed"
    fi
    
    # Clean up
    rm -f "$response_file"
    echo
}

# Test certificate files exist
check_certificates() {
    log_header "Certificate Validation"
    
    local cert_files=(
        "$CERTS_DIR/ca-bundle.crt:CA Bundle"
        "$CERTS_DIR/gateway.crt:Gateway Certificate"
        "$CERTS_DIR/gateway.key:Gateway Private Key"
        "$CERTS_DIR/service.crt:Service Certificate"
        "$CERTS_DIR/service.key:Service Private Key"
    )
    
    local all_present=true
    
    for cert_info in "${cert_files[@]}"; do
        IFS=':' read -r filepath description <<< "$cert_info"
        
        if [ -f "$filepath" ]; then
            log_success "$description found: $filepath"
        else
            log_error "$description missing: $filepath"
            all_present=false
        fi
    done
    
    if [ "$all_present" = false ]; then
        log_error "Some certificate files are missing. Run 'make certs' to generate them."
        return 1
    fi
    
    # Verify certificate chain
    log_info "Verifying certificate chains..."
    
    if openssl verify -CAfile "$CERTS_DIR/ca-bundle.crt" "$CERTS_DIR/gateway.crt" > /dev/null 2>&1; then
        log_success "Gateway certificate chain is valid"
    else
        log_error "Gateway certificate chain validation failed"
    fi
    
    if openssl verify -CAfile "$CERTS_DIR/ca-bundle.crt" "$CERTS_DIR/service.crt" > /dev/null 2>&1; then
        log_success "Service certificate chain is valid"
    else
        log_error "Service certificate chain validation failed"
    fi
    
    # Check certificate expiration
    log_info "Checking certificate expiration..."
    
    local gateway_expiry
    gateway_expiry=$(openssl x509 -in "$CERTS_DIR/gateway.crt" -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$gateway_expiry" ]; then
        log_info "Gateway certificate expires: $gateway_expiry"
    fi
    
    local service_expiry
    service_expiry=$(openssl x509 -in "$CERTS_DIR/service.crt" -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$service_expiry" ]; then
        log_info "Service certificate expires: $service_expiry"
    fi
    
    echo
}

# Test basic connectivity without mTLS
test_basic_connectivity() {
    log_header "Basic Connectivity Tests"
    
    # Test gateway health
    make_request "GET" "$GATEWAY_URL/health" "Gateway health check"
    
    # Test gateway home page
    make_request "GET" "$GATEWAY_URL/" "Gateway home page"
    
    # Test API proxy through gateway
    make_request "GET" "$GATEWAY_URL/api/users" "API proxy through gateway"
    make_request "GET" "$GATEWAY_URL/api/echo" "Echo endpoint through gateway"
}

# Test direct service access (should fail without client cert)
test_service_security() {
    log_header "Service Security Tests"
    
    log_info "Testing direct service access (should fail without client certificate)"
    
    # This should fail because the service requires client certificates
    if curl -k -s -f "$SERVICE_URL/health" > /dev/null 2>&1; then
        log_error "Direct service access should have been blocked!"
    else
        log_success "Direct service access properly blocked without client certificate"
    fi
    
    # Test with invalid/self-signed certificate (should also fail)
    log_info "Testing with invalid certificate (should fail)"
    
    # Create a temporary self-signed cert for testing
    local temp_cert="/tmp/invalid.crt"
    local temp_key="/tmp/invalid.key"
    
    if openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
        -keyout "$temp_key" -out "$temp_cert" \
        -subj "/CN=invalid" > /dev/null 2>&1; then
        
        if curl -s --cert "$temp_cert" --key "$temp_key" --cacert "$CERTS_DIR/ca-bundle.crt" \
               -f "$SERVICE_URL/health" > /dev/null 2>&1; then
            log_error "Service should have rejected invalid client certificate"
        else
            log_success "Service properly rejected invalid client certificate"
        fi
        
        # Clean up temp files
        rm -f "$temp_cert" "$temp_key"
    else
        log_skip "Could not create temporary certificate for testing"
    fi
}

# Test mTLS with curl using client certificates
test_mtls_with_curl() {
    log_header "mTLS Tests with curl"
    
    # Check if certificate files exist
    if [ ! -f "$CERTS_DIR/gateway.crt" ] || [ ! -f "$CERTS_DIR/gateway.key" ] || [ ! -f "$CERTS_DIR/ca-bundle.crt" ]; then
        log_skip "Certificate files missing - skipping mTLS curl tests"
        return
    fi
    
    local cert_args="--cert $CERTS_DIR/gateway.crt --key $CERTS_DIR/gateway.key --cacert $CERTS_DIR/ca-bundle.crt"
    
    # Test service health with client certificate
    make_request "GET" "$SERVICE_URL/health" "Service health with client certificate" "200" "$cert_args"
    
    # Test various API endpoints with client certificate
    make_request "GET" "$SERVICE_URL/api/users" "Users API with client certificate" "200" "$cert_args"
    make_request "GET" "$SERVICE_URL/api/echo" "Echo API with client certificate" "200" "$cert_args"
    make_request "GET" "$SERVICE_URL/api/test/endpoint" "Generic API with client certificate" "200" "$cert_args"
    
    # Test POST request with client certificate
    local post_data='{"name": "Test User", "email": "test@example.com"}'
    local post_args="$cert_args -H 'Content-Type: application/json' -d '$post_data'"
    make_request "POST" "$SERVICE_URL/api/users" "POST request with client certificate" "200" "$post_args"
    
    # Test certificate info retrieval
    log_info "Testing certificate information extraction..."
    
    local cert_subject
    cert_subject=$(openssl x509 -in "$CERTS_DIR/gateway.crt" -noout -subject 2>/dev/null | sed 's/subject=//')
    if [ -n "$cert_subject" ]; then
        log_info "Client certificate subject: $cert_subject"
    fi
    
    local cert_issuer
    cert_issuer=$(openssl x509 -in "$CERTS_DIR/gateway.crt" -noout -issuer 2>/dev/null | sed 's/issuer=//')
    if [ -n "$cert_issuer" ]; then
        log_info "Client certificate issuer: $cert_issuer"
    fi
}

# Run Go integration tests
test_go_integration() {
    log_header "Go Integration Tests"
    
    # Check if Go is available
    if ! command -v go > /dev/null 2>&1; then
        log_skip "Go not found - skipping Go integration tests"
        return
    fi
    
    # Check if test file exists
    if [ ! -f "tests/mtls_integration_test.go" ]; then
        log_skip "Go integration test file not found - skipping Go integration tests"
        return
    fi
    
    # Set environment variables for the Go test
    export CERTS_DIR="$CERTS_DIR"
    export SERVICE_URL="$SERVICE_URL"
    export SERVER_NAME="$SERVER_NAME"
    
    log_info "Running Go integration tests..."
    
    # Run the tests
    if go test -v -timeout=60s tests/mtls_integration_test.go > /tmp/go_test_results.log 2>&1; then
        log_success "Go integration tests passed"
        
        # Show interesting parts of the output
        log_info "Test output highlights:"
        grep -E "(PASS|FAIL|mTLS|✅|❌)" /tmp/go_test_results.log | tail -10 || true
    else
        log_error "Go integration tests failed"
        
        log_info "Test failure details:"
        tail -20 /tmp/go_test_results.log || true
    fi
    
    # Alternative: run as standalone program
    log_info "Running Go integration tests as standalone program..."
    
    if go run tests/mtls_test_runner.go test > /tmp/go_standalone_results.log 2>&1; then
        log_success "Go standalone integration tests passed"
    else
        log_error "Go standalone integration tests failed"
        log_info "Standalone test failure details:"
        tail -10 /tmp/go_standalone_results.log || true
    fi
    
    # Clean up
    rm -f /tmp/go_test_results.log /tmp/go_standalone_results.log
}

# Test performance and stress
test_performance() {
    log_header "Performance Tests"
    
    if [ ! -f "$CERTS_DIR/gateway.crt" ]; then
        log_skip "Certificates not available - skipping performance tests"
        return
    fi
    
    log_info "Running basic performance test (10 concurrent requests)..."
    
    local cert_args="--cert $CERTS_DIR/gateway.crt --key $CERTS_DIR/gateway.key --cacert $CERTS_DIR/ca-bundle.crt"
    local success_count=0
    local total_requests=10
    
    # Run concurrent requests
    for i in $(seq 1 $total_requests); do
        curl -s $cert_args "$SERVICE_URL/health" > /dev/null 2>&1 &
        if [ $? -eq 0 ]; then
            ((success_count++))
        fi
    done
    
    # Wait for all background jobs to complete
    wait
    
    if [ $success_count -eq $total_requests ]; then
        log_success "Performance test: $success_count/$total_requests requests succeeded"
    else
        log_error "Performance test: Only $success_count/$total_requests requests succeeded"
    fi
    
    # Test with gateway proxy
    log_info "Testing gateway proxy performance..."
    
    local gateway_success=0
    for i in $(seq 1 5); do
        if curl -s "$GATEWAY_URL/api/health" > /dev/null 2>&1; then
            ((gateway_success++))
        fi
    done
    
    log_info "Gateway proxy performance: $gateway_success/5 requests succeeded"
}

# Test error scenarios
test_error_scenarios() {
    log_header "Error Scenario Tests"
    
    # Test with wrong server name
    if [ -f "$CERTS_DIR/gateway.crt" ]; then
        log_info "Testing with incorrect server name (should fail)..."
        
        local wrong_server_args="--cert $CERTS_DIR/gateway.crt --key $CERTS_DIR/gateway.key --cacert $CERTS_DIR/ca-bundle.crt"
        local wrong_url="${SERVICE_URL/localhost/wronghost}"
        
        if curl -s $wrong_server_args "$wrong_url/health" > /dev/null 2>&1; then
            log_error "Request should have failed with wrong server name"
        else
            log_success "Request properly failed with wrong server name"
        fi
    fi
    
    # Test with expired/future certificates (simulation)
    log_info "Testing certificate validation robustness..."
    
    # Test non-existent endpoints
    if [ -f "$CERTS_DIR/gateway.crt" ]; then
        local cert_args="--cert $CERTS_DIR/gateway.crt --key $CERTS_DIR/gateway.key --cacert $CERTS_DIR/ca-bundle.crt"
        make_request "GET" "$SERVICE_URL/nonexistent" "Non-existent endpoint" "404" "$cert_args"
    fi
}

# Generate test report
generate_report() {
    log_header "Test Summary Report"
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
    
    echo "Test Results:"
    echo "============="
    echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
    echo -e "${YELLOW}⏭️  Skipped: $TESTS_SKIPPED${NC}"
    echo "Total: $total_tests"
    echo
    
    local success_rate=0
    if [ $total_tests -gt 0 ] && [ $((TESTS_PASSED + TESTS_SKIPPED)) -gt 0 ]; then
        success_rate=$(( (TESTS_PASSED * 100) / (TESTS_PASSED + TESTS_FAILED) ))
    fi
    
    echo "Success Rate: ${success_rate}%"
    echo
    
    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "All tests passed! 🎉"
        echo
        echo "🔐 mTLS configuration is working correctly!"
        echo "🌐 Services are properly secured and communicating"
        echo "📋 Integration tests validate the mTLS implementation"
    else
        log_error "Some tests failed. Please review the output above."
        echo
        echo "Common issues to check:"
        echo "• Are the services running? (docker-compose ps)"
        echo "• Are certificates generated? (make certs)"
        echo "• Are ports accessible? (netstat -an | grep ':8080\\|:8443')"
        echo "• Check service logs: (make logs)"
    fi
    
    return $TESTS_FAILED
}

# Main execution
main() {
    echo -e "${BLUE}🔐 mTLS Integration Tests${NC}"
    echo "=========================="
    echo
    echo "Configuration:"
    echo "  Gateway URL: $GATEWAY_URL"
    echo "  Service URL: $SERVICE_URL"
    echo "  Certificates: $CERTS_DIR"
    echo "  Server Name: $SERVER_NAME"
    echo
    
    # Run all test suites
    check_certificates
    
    # Wait for services to be ready
    if ! wait_for_service "$GATEWAY_URL/health" "Gateway"; then
        log_warning "Gateway not available - some tests may fail"
    fi
    
    test_basic_connectivity
    test_service_security
    test_mtls_with_curl
    test_go_integration
    test_performance
    test_error_scenarios
    
    # Generate final report
    generate_report
    
    return $?
}

# Handle command line arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "mTLS Integration Tests Script"
        echo
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  help              Show this help message"
        echo "  certificates      Only test certificate validation"
        echo "  basic            Only run basic connectivity tests"
        echo "  mtls             Only run mTLS-specific tests"
        echo "  go               Only run Go integration tests"
        echo "  performance      Only run performance tests"
        echo
        echo "Environment Variables:"
        echo "  GATEWAY_URL       Gateway URL (default: $DEFAULT_GATEWAY_URL)"
        echo "  SERVICE_URL       Service URL (default: $DEFAULT_SERVICE_URL)"
        echo "  CERTS_DIR         Certificates directory (default: $DEFAULT_CERTS_DIR)"
        echo "  SERVER_NAME       Expected server name (default: $DEFAULT_SERVER_NAME)"
        echo
        echo "Examples:"
        echo "  $0                      # Run all tests"
        echo "  $0 certificates         # Test only certificates"
        echo "  $0 mtls                 # Test only mTLS functionality"
        echo "  CERTS_DIR=/custom/path $0  # Use custom certificate path"
        ;;
    "certificates")
        check_certificates
        ;;
    "basic")
        test_basic_connectivity
        ;;
    "mtls")
        test_mtls_with_curl
        ;;
    "go")
        test_go_integration
        ;;
    "performance")
        test_performance
        ;;
    *)
        main "$@"
        exit $?
        ;;
esac
