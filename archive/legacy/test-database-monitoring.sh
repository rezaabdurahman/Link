#!/bin/bash

# Test Database Monitoring Integration
set -e

echo "🧪 Testing Database Monitoring Integration..."

# Test 1: Check if database monitoring library exists in services
echo "1. Checking database monitoring library deployment..."

SERVICES=("api-gateway" "user-svc" "chat-svc" "discovery-svc" "search-svc")

for service in "${SERVICES[@]}"; do
    if [ -d "backend/$service/internal/database" ]; then
        echo "✅ $service: Database monitoring library found"
    else
        echo "❌ $service: Database monitoring library missing"
    fi
done

# Test 2: Check if integration examples exist
echo ""
echo "2. Checking integration examples..."

for service in "${SERVICES[@]}"; do
    if [ -f "backend/$service/internal/database/monitoring_integration.go" ]; then
        echo "✅ $service: Integration example found"
    else
        echo "❌ $service: Integration example missing"
    fi
done

# Test 3: Check if Prometheus alerts exist
echo ""
echo "3. Testing Prometheus configuration..."

if [ -f "monitoring/prometheus/rules/database_alerts.yml" ]; then
    echo "✅ Database alerts configuration exists"
else
    echo "❌ Database alerts configuration missing"
fi

if grep -q "database_alerts.yml" "monitoring/prometheus/prometheus.yml" 2>/dev/null; then
    echo "✅ Database alerts configured in Prometheus"
else
    echo "❌ Database alerts not configured in Prometheus"
fi

# Test 4: Check if Grafana dashboard exists
echo ""
echo "4. Testing Grafana dashboard..."

if [ -f "monitoring/grafana/dashboards/database-performance.json" ]; then
    echo "✅ Database performance dashboard exists"
else
    echo "❌ Database performance dashboard missing"
fi

# Test 5: Check Go modules
echo ""
echo "5. Testing Go dependencies..."

for service in "${SERVICES[@]}"; do
    if [ -f "backend/$service/go.mod" ]; then
        cd "backend/$service"
        if go list -m github.com/prometheus/client_golang >/dev/null 2>&1; then
            echo "✅ $service: Prometheus client dependency found"
        else
            echo "❌ $service: Prometheus client dependency missing"
        fi
        if go list -m github.com/getsentry/sentry-go >/dev/null 2>&1; then
            echo "✅ $service: Sentry dependency found"
        else
            echo "❌ $service: Sentry dependency missing"
        fi
        cd "../.."
    fi
done

echo ""
echo "🎉 Database monitoring integration test complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Update your database initialization to use: database.InitDBWithMonitoring(\"service-name\")"
echo "  2. Rebuild and restart your services"
echo "  3. Check for database metrics at your service /metrics endpoints"
echo "  4. Import the Grafana dashboard from monitoring/grafana/dashboards/"
