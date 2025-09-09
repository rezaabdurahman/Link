#!/bin/bash
# Unified Security Testing Suite
# Comprehensive security testing including JWT manipulation, service boundaries,
# database isolation, and infrastructure security validation

set -e

# Load service registry
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$PROJECT_ROOT/scripts/services.conf"

# Configuration
API_GATEWAY_URL="${API_GATEWAY_URL:-http://localhost:8080}"
TEST_RESULTS_DIR="$PROJECT_ROOT/security_test_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEST_TIMEOUT="${TEST_TIMEOUT:-30}"
SERVICE_STARTUP_TIMEOUT="${SERVICE_STARTUP_TIMEOUT:-60}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
VALIDATE_ONLY=false
VERBOSE=false
QUICK_MODE=false

# Create results directory
mkdir -p "$TEST_RESULTS_DIR"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    [ "$VERBOSE" = true ] && echo "[$(date '+%H:%M:%S')] $1" >> "$TEST_RESULTS_DIR/security_test_${TIMESTAMP}.log"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date '+%H:%M:%S')] SUCCESS: $1" >> "$TEST_RESULTS_DIR/security_test_${TIMESTAMP}.log"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[$(date '+%H:%M:%S')] WARNING: $1" >> "$TEST_RESULTS_DIR/security_test_${TIMESTAMP}.log"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[$(date '+%H:%M:%S')] ERROR: $1" >> "$TEST_RESULTS_DIR/security_test_${TIMESTAMP}.log"
}

# Function to log detailed test results
log_test_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    log_info "Test: $test_name"
    echo "$result"
    if [ -n "$details" ]; then
        echo "$details" > "$TEST_RESULTS_DIR/${test_name}_${TIMESTAMP}.log"
    fi
    echo ""
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    for service in "${SERVICES[@]}"; do
        local port=$(get_service_port "$service")
        local health_endpoint=$(get_health_endpoint "$service")
        local url="http://localhost:${port}${health_endpoint}"
        local max_attempts=$((SERVICE_STARTUP_TIMEOUT / 2))
        local attempt=1
        
        log_info "Checking $service at $url"
        
        while [ $attempt -le $max_attempts ]; do
            if curl --connect-timeout 5 --max-time 10 -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
                log_success "$service is ready"
                break
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                log_warning "$service not responding after $max_attempts attempts"
                break
            fi
            
            sleep 2
            attempt=$((attempt + 1))
        done
    done
}

# Test 1: Service Boundary Validation
test_service_boundaries() {
    log_info "=== Testing Service Security Boundaries ==="
    
    # Test 1.1: Verify app users cannot access infrastructure permissions
    log_info "1.1 Testing app user boundary violations..."
    local infrastructure_perms=("admin.system" "admin.roles" "admin.analytics" "services.configure" "services.deploy")
    
    for perm in "${infrastructure_perms[@]}"; do
        if grep -q "$perm" "$PROJECT_ROOT/backend/user-svc/migrations/007_rbac_system.up.sql" 2>/dev/null; then
            # Permission exists in original system, check if it's removed in cleanup
            if ! grep -q "'$perm'" "$PROJECT_ROOT/backend/user-svc/migrations/010_cleanup_user_roles.up.sql" 2>/dev/null; then
                log_error "Infrastructure permission '$perm' not removed in cleanup migration"
                return 1
            fi
        fi
    done
    log_success "Infrastructure permissions properly removed from app user system"
    
    # Test 1.2: Verify community_moderator has only content permissions
    log_info "1.2 Testing community moderator permissions..."
    local invalid_moderator_perms=("admin.system" "services.configure" "services.deploy")
    
    for perm in "${invalid_moderator_perms[@]}"; do
        if grep -A 10 "community_moderator.*AND p.name IN" "$PROJECT_ROOT/backend/user-svc/migrations/007_rbac_system.up.sql" 2>/dev/null | grep -q "$perm"; then
            log_error "Community moderator has invalid infrastructure permission: $perm"
            return 1
        fi
    done
    log_success "Community moderator permissions are properly scoped"
    
    # Test 1.3: Verify middleware functions use correct role names
    log_info "1.3 Testing middleware role name consistency..."
    if find "$PROJECT_ROOT/backend/api-gateway/internal/middleware/" -name "*.go" -exec grep -l "IsAdmin\|RequireAdmin" {} \; 2>/dev/null | grep -q .; then
        log_error "Legacy admin function references found in middleware"
        return 1
    fi
    
    if ! find "$PROJECT_ROOT/backend/api-gateway/internal/middleware/" -name "*.go" -exec grep -l "IsCommunityModerator\|RequireCommunityModerator" {} \; 2>/dev/null | grep -q .; then
        log_warning "Community moderator functions not found in middleware (may be expected)"
    fi
    log_success "Middleware uses correct role names"
    
    # Test 1.4: Verify service accounts are separate from app users
    log_info "1.4 Testing service account separation..."
    if ! grep -q "CREATE TABLE service_accounts" "$PROJECT_ROOT/backend/user-svc/migrations/009_service_accounts.up.sql" 2>/dev/null; then
        log_error "Service accounts table not found in migration"
        return 1
    fi
    log_success "Service accounts properly separated from app users"
}

# Test 2: Database Isolation
test_database_isolation() {
    log_info "=== Testing Database Isolation ==="
    
    # Check if database isolation is configured
    if [ -f "$PROJECT_ROOT/.env.db-isolation" ]; then
        log_success "Database isolation configuration found"
        
        # Source the environment file
        source "$PROJECT_ROOT/.env.db-isolation"
        
        # Test database connections for each service
        log_info "Testing database connections..."
        
        for service in "${SERVICES[@]}"; do
            local port=$(get_service_port "$service")
            local health_url="http://localhost:${port}/health/live"
            
            if curl -f "$health_url" >/dev/null 2>&1; then
                log_success "$service: Database connection verified"
            else
                log_warning "$service: Could not verify database connection"
            fi
        done
    else
        log_warning "Database isolation configuration not found"
    fi
}

# Test 3: JWT Token Security
test_jwt_security() {
    log_info "=== Testing JWT Token Security ==="
    
    # Test 3.1: Invalid token rejection
    log_info "3.1 Testing invalid token rejection..."
    local response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer invalid.jwt.token" \
        "$API_GATEWAY_URL/api/v1/users/profile" -o /dev/null)
    
    if [ "$response" = "401" ]; then
        log_success "Invalid JWT tokens properly rejected"
    else
        log_error "Invalid JWT token not properly rejected (got $response)"
        return 1
    fi
    
    # Test 3.2: Missing token handling
    log_info "3.2 Testing missing token handling..."
    response=$(curl -s -w "%{http_code}" "$API_GATEWAY_URL/api/v1/users/profile" -o /dev/null)
    
    if [ "$response" = "401" ]; then
        log_success "Missing JWT tokens properly handled"
    else
        log_error "Missing JWT token not properly handled (got $response)"
        return 1
    fi
    
    # Test 3.3: Malformed token handling
    log_info "3.3 Testing malformed token handling..."
    response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer malformed-token" \
        "$API_GATEWAY_URL/api/v1/users/profile" -o /dev/null)
    
    if [ "$response" = "401" ]; then
        log_success "Malformed JWT tokens properly rejected"
    else
        log_error "Malformed JWT token not properly rejected (got $response)"
        return 1
    fi
}

# Test 4: CORS and Header Security
test_cors_security() {
    log_info "=== Testing CORS and Header Security ==="
    
    # Test 4.1: CORS preflight requests
    log_info "4.1 Testing CORS preflight handling..."
    local response=$(curl -s -w "%{http_code}" -X OPTIONS \
        -H "Origin: https://malicious-site.com" \
        -H "Access-Control-Request-Method: POST" \
        "$API_GATEWAY_URL/api/v1/users/login" -o /dev/null)
    
    if [ "$response" = "403" ] || [ "$response" = "405" ]; then
        log_success "CORS properly configured for cross-origin requests"
    else
        log_warning "CORS configuration may need review (got $response)"
    fi
    
    # Test 4.2: Security headers presence
    log_info "4.2 Testing security headers..."
    local headers=$(curl -s -I "$API_GATEWAY_URL/health")
    
    if echo "$headers" | grep -i "x-frame-options" >/dev/null; then
        log_success "X-Frame-Options header present"
    else
        log_warning "X-Frame-Options header missing"
    fi
    
    if echo "$headers" | grep -i "x-content-type-options" >/dev/null; then
        log_success "X-Content-Type-Options header present"
    else
        log_warning "X-Content-Type-Options header missing"
    fi
}

# Test 5: Rate Limiting
test_rate_limiting() {
    log_info "=== Testing Rate Limiting ==="
    
    local endpoint="$API_GATEWAY_URL/api/v1/users/login"
    local success_count=0
    local rate_limited_count=0
    
    log_info "Sending multiple requests to test rate limiting..."
    
    for i in {1..20}; do
        local response=$(curl -s -w "%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d '{"email":"test@example.com","password":"invalid"}' \
            "$endpoint" -o /dev/null)
        
        if [ "$response" = "429" ]; then
            rate_limited_count=$((rate_limited_count + 1))
        else
            success_count=$((success_count + 1))
        fi
        
        [ "$QUICK_MODE" = false ] && sleep 0.1
    done
    
    if [ $rate_limited_count -gt 0 ]; then
        log_success "Rate limiting is working ($rate_limited_count requests limited)"
    else
        log_warning "Rate limiting may not be configured ($success_count requests succeeded)"
    fi
}

# Test 6: Input Validation
test_input_validation() {
    log_info "=== Testing Input Validation ==="
    
    # Test 6.1: SQL injection attempt
    log_info "6.1 Testing SQL injection protection..."
    local sql_injection_payload='{"email":"admin@test.com'"'"'OR 1=1--","password":"test"}'
    local response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$sql_injection_payload" \
        "$API_GATEWAY_URL/api/v1/users/login" -o /dev/null)
    
    if [ "$response" = "400" ] || [ "$response" = "422" ]; then
        log_success "SQL injection attempt properly blocked"
    else
        log_warning "SQL injection protection may need review (got $response)"
    fi
    
    # Test 6.2: XSS attempt
    log_info "6.2 Testing XSS protection..."
    local xss_payload='{"email":"<script>alert(1)</script>@test.com","password":"test"}'
    response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$xss_payload" \
        "$API_GATEWAY_URL/api/v1/users/login" -o /dev/null)
    
    if [ "$response" = "400" ] || [ "$response" = "422" ]; then
        log_success "XSS attempt properly blocked"
    else
        log_warning "XSS protection may need review (got $response)"
    fi
}

# Test 7: Service Communication Security
test_service_communication() {
    log_info "=== Testing Inter-Service Communication Security ==="
    
    # Check if mTLS is configured (Linkerd)
    if kubectl get pods -n linkerd >/dev/null 2>&1; then
        log_success "Linkerd service mesh detected"
        
        # Check mTLS status
        if linkerd stat --help >/dev/null 2>&1; then
            local mtls_status=$(linkerd stat deploy --namespace linkerd-viz 2>/dev/null | grep -i success || echo "unknown")
            if [ "$mtls_status" != "unknown" ]; then
                log_success "mTLS appears to be active"
            else
                log_warning "mTLS status unclear"
            fi
        else
            log_info "Linkerd CLI not available for detailed mTLS verification"
        fi
    else
        log_info "Service mesh not detected (may be using direct Docker networking)"
    fi
}

# Main test execution
run_security_tests() {
    log_info "🛡️  Link Application Security Testing Suite"
    log_info "Timestamp: $TIMESTAMP"
    log_info "Results directory: $TEST_RESULTS_DIR"
    echo ""
    
    local test_failures=0
    
    # Wait for services unless in validate-only mode
    if [ "$VALIDATE_ONLY" = false ]; then
        wait_for_services
    fi
    
    # Run test suites
    test_service_boundaries || test_failures=$((test_failures + 1))
    echo ""
    
    test_database_isolation || test_failures=$((test_failures + 1))
    echo ""
    
    if [ "$VALIDATE_ONLY" = false ]; then
        test_jwt_security || test_failures=$((test_failures + 1))
        echo ""
        
        test_cors_security || test_failures=$((test_failures + 1))
        echo ""
        
        test_rate_limiting || test_failures=$((test_failures + 1))
        echo ""
        
        test_input_validation || test_failures=$((test_failures + 1))
        echo ""
        
        test_service_communication || test_failures=$((test_failures + 1))
        echo ""
    fi
    
    # Summary
    echo "============================================="
    if [ $test_failures -eq 0 ]; then
        log_success "All security tests passed! ✅"
        echo "Results saved to: $TEST_RESULTS_DIR/security_test_${TIMESTAMP}.log"
    else
        log_error "$test_failures test suite(s) failed ❌"
        echo "Check detailed results in: $TEST_RESULTS_DIR/"
        exit 1
    fi
}

# Usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Unified security testing suite for the Link application.

OPTIONS:
    --validate-only     Only run static validation tests (no service calls)
    --verbose           Enable verbose logging
    --quick             Skip delays in rate limiting tests
    --help              Show this help message

EXAMPLES:
    $0                          # Run complete security test suite
    $0 --validate-only          # Run only static validation tests
    $0 --verbose --quick        # Run with verbose output and quick mode

ENVIRONMENT:
    API_GATEWAY_URL            API Gateway URL (default: http://localhost:8080)
    SECURITY_TEST_TIMEOUT      Timeout for individual tests (default: 30s)

The test suite includes:
    - Service boundary validation
    - Database isolation testing
    - JWT token security testing
    - CORS and header security
    - Rate limiting verification
    - Input validation testing
    - Inter-service communication security
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --validate-only)
            VALIDATE_ONLY=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run the security tests
run_security_tests