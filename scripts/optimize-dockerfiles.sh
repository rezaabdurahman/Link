#!/bin/bash
# Script to apply consistent Dockerfile optimizations across all services

set -e

SERVICES=("chat-svc" "ai-svc" "discovery-svc" "search-svc")
BACKEND_DIR="backend"

echo "🚀 Optimizing Dockerfiles for faster builds..."

for service in "${SERVICES[@]}"; do
    dockerfile="${BACKEND_DIR}/${service}/Dockerfile"
    
    if [[ -f "$dockerfile" ]]; then
        echo "📝 Checking $service Dockerfile..."
        
        # Check if it has multi-stage optimization
        if ! grep -q "FROM golang:.* AS deps" "$dockerfile"; then
            echo "⚠️  $service needs Dockerfile optimization"
            echo "   Consider adding multi-stage build with deps stage"
        else
            echo "✅ $service Dockerfile is optimized"
        fi
        
        # Check for build flags
        if ! grep -q "\-ldflags.*-w -s" "$dockerfile"; then
            echo "⚠️  $service could benefit from build optimization flags"
            echo "   Consider adding: -ldflags='-w -s -extldflags \"-static\"'"
        fi
        
    else
        echo "❌ No Dockerfile found for $service"
    fi
done

echo ""
echo "🛠️  Quick optimization checklist:"
echo "   ✅ Multi-stage builds with deps layer"
echo "   ✅ Copy go.mod/go.sum before source code"  
echo "   ✅ Use build optimization flags (-ldflags='-w -s')"
echo "   ✅ Add .dockerignore files"
echo "   ✅ Use specific base image tags"
echo ""
echo "📚 See user-svc/Dockerfile and api-gateway/Dockerfile for optimized examples"