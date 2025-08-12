#!/bin/bash

# run-api-tests.sh
# Script to run API contract tests using Newman

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
COLLECTION_FILE="api/chat-svc-api-tests.postman_collection.json"
ENVIRONMENT_FILE="${ENVIRONMENT_FILE:-}"
OUTPUT_DIR="${OUTPUT_DIR:-./test-results}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if required tools are installed
check_dependencies() {
    print_status $BLUE "Checking dependencies..."
    
    if ! command -v newman &> /dev/null; then
        print_status $RED "Newman is not installed. Please install it with:"
        echo "  npm install -g newman"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_status $YELLOW "jq is not installed. Results will be less formatted."
        echo "  Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    fi
    
    print_status $GREEN "Dependencies check passed!"
}

# Function to check if the API is running
check_api_health() {
    print_status $BLUE "Checking API health at $BASE_URL..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$BASE_URL/health/liveness" > /dev/null 2>&1; then
            print_status $GREEN "API is healthy and ready!"
            return 0
        fi
        
        print_status $YELLOW "Attempt $attempt/$max_attempts: API not ready, waiting..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_status $RED "API is not responding after $max_attempts attempts"
    print_status $RED "Please ensure the chat service is running at $BASE_URL"
    exit 1
}

# Function to create environment file
create_environment() {
    local env_file="$OUTPUT_DIR/test-environment.json"
    
    print_status $BLUE "Creating test environment..."
    
    cat > "$env_file" << EOF
{
    "id": "test-environment",
    "name": "Test Environment",
    "values": [
        {
            "key": "base_url",
            "value": "$BASE_URL",
            "enabled": true
        },
        {
            "key": "jwt_token",
            "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzNDU2NzgtOTBhYi1jZGVmLTEyMzQtNTY3ODkwYWJjZGVmIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjo5OTk5OTk5OTk5fQ.test-signature",
            "enabled": true
        }
    ]
}
EOF
    
    echo "$env_file"
}

# Function to run Newman tests
run_tests() {
    local collection_path="$1"
    local environment_path="$2"
    
    print_status $BLUE "Running API contract tests..."
    
    local newman_args=(
        run "$collection_path"
        --reporters cli,json,html
        --reporter-json-export "$OUTPUT_DIR/newman-results.json"
        --reporter-html-export "$OUTPUT_DIR/newman-results.html"
        --disable-unicode
        --color off
    )
    
    if [ -n "$environment_path" ]; then
        newman_args+=(--environment "$environment_path")
    fi
    
    # Run Newman and capture exit code
    if newman "${newman_args[@]}"; then
        print_status $GREEN "All tests passed!"
        return 0
    else
        print_status $RED "Some tests failed!"
        return 1
    fi
}

# Function to display test results
display_results() {
    local results_file="$OUTPUT_DIR/newman-results.json"
    
    if [ -f "$results_file" ] && command -v jq &> /dev/null; then
        print_status $BLUE "Test Results Summary:"
        echo "===================="
        
        local total_tests=$(jq '.run.stats.assertions.total' "$results_file")
        local passed_tests=$(jq '.run.stats.assertions.total - .run.stats.assertions.failed' "$results_file")
        local failed_tests=$(jq '.run.stats.assertions.failed' "$results_file")
        local total_requests=$(jq '.run.stats.requests.total' "$results_file")
        
        echo "Total Requests: $total_requests"
        echo "Total Assertions: $total_tests"
        echo "Passed: $passed_tests"
        echo "Failed: $failed_tests"
        
        if [ "$failed_tests" -gt 0 ]; then
            print_status $RED "❌ $failed_tests test(s) failed"
            
            # Show failed test details
            echo ""
            print_status $YELLOW "Failed Tests:"
            jq -r '.run.executions[] | select(.assertions[]? | select(.error != null)) | "- " + .item.name + ": " + (.assertions[] | select(.error != null) | .error.message)' "$results_file" 2>/dev/null || echo "Unable to parse detailed failure information"
            
            return 1
        else
            print_status $GREEN "✅ All tests passed!"
            return 0
        fi
    else
        if [ ! -f "$results_file" ]; then
            print_status $YELLOW "Results file not found: $results_file"
        else
            print_status $YELLOW "jq not available - install jq for detailed results"
        fi
    fi
}

# Main function
main() {
    print_status $BLUE "Starting API Contract Tests"
    print_status $BLUE "============================="
    
    # Check if collection file exists
    if [ ! -f "$COLLECTION_FILE" ]; then
        print_status $RED "Collection file not found: $COLLECTION_FILE"
        print_status $RED "Please run this script from the project root directory"
        exit 1
    fi
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Check dependencies
    check_dependencies
    
    # Check API health
    check_api_health
    
    # Create or use environment file
    local env_file
    if [ -n "$ENVIRONMENT_FILE" ] && [ -f "$ENVIRONMENT_FILE" ]; then
        env_file="$ENVIRONMENT_FILE"
        print_status $BLUE "Using provided environment file: $env_file"
    else
        env_file=$(create_environment)
        print_status $BLUE "Created test environment file: $env_file"
    fi
    
    # Run tests
    local test_exit_code=0
    run_tests "$COLLECTION_FILE" "$env_file" || test_exit_code=$?
    
    # Display results
    display_results || test_exit_code=$?
    
    # Show report locations
    echo ""
    print_status $BLUE "Reports generated:"
    echo "- JSON: $OUTPUT_DIR/newman-results.json"
    echo "- HTML: $OUTPUT_DIR/newman-results.html"
    
    if [ $test_exit_code -eq 0 ]; then
        print_status $GREEN "🎉 All API contract tests passed!"
    else
        print_status $RED "💥 API contract tests failed!"
    fi
    
    exit $test_exit_code
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Run API contract tests for the Chat Service using Newman/Postman.

Options:
    -h, --help              Show this help message
    -u, --url URL           Base URL for the API (default: http://localhost:8080)
    -e, --environment FILE  Use custom environment file
    -o, --output DIR        Output directory for test results (default: ./test-results)

Environment Variables:
    BASE_URL                Base URL for the API
    ENVIRONMENT_FILE        Path to environment file
    OUTPUT_DIR              Output directory for results

Examples:
    $0                                          # Run tests against localhost:8080
    $0 -u https://api.example.com               # Run tests against remote API
    $0 -e my-env.json -o /tmp/results          # Use custom environment and output dir

Prerequisites:
    - Newman (npm install -g newman)
    - jq (optional, for formatted results)
    - Chat service running and accessible

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT_FILE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        *)
            print_status $RED "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main
