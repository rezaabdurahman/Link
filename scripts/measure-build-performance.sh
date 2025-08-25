#!/bin/bash
# Script to measure and compare build performance

set -e

SERVICE=${1:-"user-svc"}
ITERATIONS=${2:-3}

echo "🏗️  Measuring build performance for $SERVICE..."
echo "📊 Running $ITERATIONS iterations..."

# Create temp file for results
RESULTS_FILE="/tmp/build_results_$(date +%s).txt"

echo "Build Performance Results - $(date)" > "$RESULTS_FILE"
echo "Service: $SERVICE" >> "$RESULTS_FILE"
echo "Iterations: $ITERATIONS" >> "$RESULTS_FILE"
echo "=========================" >> "$RESULTS_FILE"

total_time=0

for i in $(seq 1 $ITERATIONS); do
    echo "🔄 Iteration $i/$ITERATIONS..."
    
    # Clear Docker build cache for fair comparison
    docker builder prune -f > /dev/null 2>&1
    
    # Time the build
    start_time=$(date +%s)
    
    docker build \
        --no-cache \
        -t "${SERVICE}:perf-test-${i}" \
        -f "backend/${SERVICE}/Dockerfile" \
        backend/ > /dev/null 2>&1
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    total_time=$((total_time + duration))
    
    echo "  ⏱️  Build time: ${duration}s"
    echo "Iteration $i: ${duration}s" >> "$RESULTS_FILE"
done

avg_time=$((total_time / ITERATIONS))

echo "" >> "$RESULTS_FILE"
echo "Average build time: ${avg_time}s" >> "$RESULTS_FILE"
echo "Total time: ${total_time}s" >> "$RESULTS_FILE"

echo ""
echo "📈 Performance Summary:"
echo "   Average build time: ${avg_time}s" 
echo "   Total time: ${total_time}s"
echo "   Results saved to: $RESULTS_FILE"

# Clean up test images
docker images -q "${SERVICE}:perf-test-*" | xargs -r docker rmi > /dev/null 2>&1

echo ""
echo "💡 Build optimization tips:"
echo "   - Use 'docker build --cache-from' for registry caching"
echo "   - Enable BuildKit: export DOCKER_BUILDKIT=1"
echo "   - Check .dockerignore to reduce build context"
echo "   - Use multi-stage builds to cache dependencies"