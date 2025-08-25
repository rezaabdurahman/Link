#!/bin/bash
# Backend service tests hook
set -e

echo "🧪 Running backend service tests..."

# Get the list of changed Go files
changed_services=()
backend_dir="backend"

# Detect which services have changed
for service_dir in "$backend_dir"/*; do
    if [ -d "$service_dir" ] && [ "$service_dir" != "$backend_dir/shared-libs" ]; then
        service_name=$(basename "$service_dir")
        
        # Check if any Go files in this service have been modified
        if git diff --cached --name-only | grep -q "^$service_dir/.*\.go$" || git diff --name-only | grep -q "^$service_dir/.*\.go$"; then
            changed_services+=("$service_name")
            echo "📝 Detected changes in $service_name"
        fi
    fi
done

# If no services changed, check shared-libs
if [ ${#changed_services[@]} -eq 0 ]; then
    if git diff --cached --name-only | grep -q "^$backend_dir/shared-libs/.*\.go$" || git diff --name-only | grep -q "^$backend_dir/shared-libs/.*\.go$"; then
        echo "📝 Detected changes in shared-libs, running all service tests"
        # If shared-libs changed, test all services
        for service_dir in "$backend_dir"/*; do
            if [ -d "$service_dir" ] && [ "$service_dir" != "$backend_dir/shared-libs" ] && [ -f "$service_dir/Makefile" ]; then
                changed_services+=($(basename "$service_dir"))
            fi
        done
    fi
fi

if [ ${#changed_services[@]} -eq 0 ]; then
    echo "📝 No backend services have changed, skipping tests"
    exit 0
fi

violations=0

# Test each changed service
for service in "${changed_services[@]}"; do
    service_dir="$backend_dir/$service"
    echo "Testing $service..."
    
    if [ -d "$service_dir" ] && [ -f "$service_dir/Makefile" ]; then
        cd "$service_dir"
        
        # Run Go formatting
        echo "Running go fmt for $service..."
        if ! gofmt -l . | grep -q .; then
            echo "✅ Go formatting passed for $service"
        else
            echo "❌ Go formatting failed for $service"
            gofmt -l .
            violations=$((violations + 1))
        fi
        
        # Run Go vet
        echo "Running go vet for $service..."
        if go vet ./...; then
            echo "✅ Go vet passed for $service"
        else
            echo "❌ Go vet failed for $service"
            violations=$((violations + 1))
        fi
        
        # Run tests
        echo "Running tests for $service..."
        if make test 2>/dev/null || go test -short ./...; then
            echo "✅ Tests passed for $service"
        else
            echo "❌ Tests failed for $service"
            violations=$((violations + 1))
        fi
        
        # Run golangci-lint if available
        if command -v golangci-lint &> /dev/null; then
            echo "Running golangci-lint for $service..."
            if golangci-lint run --timeout=2m; then
                echo "✅ Linting passed for $service"
            else
                echo "❌ Linting failed for $service"
                violations=$((violations + 1))
            fi
        else
            echo "⚠️  golangci-lint not found, skipping linting for $service"
        fi
        
        cd - > /dev/null
    else
        echo "❌ No Makefile found for $service, skipping tests"
    fi
done

# Test shared-libs if it has changes
if git diff --cached --name-only | grep -q "^$backend_dir/shared-libs/.*\.go$" || git diff --name-only | grep -q "^$backend_dir/shared-libs/.*\.go$"; then
    echo "Testing shared-libs..."
    cd "$backend_dir/shared-libs"
    
    if go test -short ./...; then
        echo "✅ Shared-libs tests passed"
    else
        echo "❌ Shared-libs tests failed"
        violations=$((violations + 1))
    fi
    
    cd - > /dev/null
fi

if [ $violations -gt 0 ]; then
    echo "❌ Backend service validation failed with $violations violations"
    echo "💡 Fix the issues above before committing"
    exit 1
else
    echo "✅ All backend service tests passed"
fi