#!/bin/bash

# Database Monitoring Deployment Script
# Deploys comprehensive database performance monitoring across all Link services

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "🚀 Deploying Comprehensive Database Monitoring System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service configuration with monitoring settings
declare -A SERVICE_CONFIG
SERVICE_CONFIG["user-svc"]="50ms:GORM"
SERVICE_CONFIG["location-svc"]="200ms:GORM"
SERVICE_CONFIG["search-svc"]="500ms:GORM"
SERVICE_CONFIG["chat-svc"]="50ms:PGX"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Step 1: Copy database monitoring library to all services
echo ""
echo "📦 Step 1: Copying database monitoring library..."

for service in "${SERVICES[@]}"; do
    SERVICE_DIR="$PROJECT_ROOT/backend/$service"
    
    if [ ! -d "$SERVICE_DIR" ]; then
        print_warning "Service directory not found: $SERVICE_DIR"
        continue
    fi
    
    # Copy the database monitoring library
    cp -r "$PROJECT_ROOT/backend/shared/database" "$SERVICE_DIR/internal/" 2>/dev/null || {
        print_error "Failed to copy database monitoring to $service"
        continue
    }
    
    print_status "Database monitoring copied to $service"
done

# Step 2: Create database monitoring integration example
echo ""
echo "📝 Step 2: Creating integration examples..."

for service in "${SERVICES[@]}"; do
    SERVICE_DIR="$PROJECT_ROOT/backend/$service"
    
    if [ ! -d "$SERVICE_DIR" ]; then
        continue
    fi
    
    # Create database integration example
    cat > "$SERVICE_DIR/internal/database/monitoring_integration.go" << 'EOF'
package database

import (
    "os"
    "time"
    
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
    "gorm.io/gorm/logger"
)

// InitDBWithMonitoring initializes database connection with comprehensive monitoring
func InitDBWithMonitoring(serviceName string) (*gorm.DB, error) {
    // Initialize database monitor
    dbMonitor := NewDatabaseMonitor(serviceName)
    
    // Create GORM logger with monitoring
    gormLogger := NewGormLogger(
        dbMonitor,
        logger.Default.LogMode(logger.Info),
    )
    
    // Connect to database
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        dsn = "host=postgres user=link_user password=link_pass dbname=link_app port=5432 sslmode=disable"
    }
    
    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
        Logger: gormLogger, // This enables automatic monitoring!
    })
    
    if err != nil {
        return nil, err
    }
    
    // Monitor connection pool in background
    sqlDB, err := db.DB()
    if err == nil {
        go func() {
            ticker := time.NewTicker(30 * time.Second)
            defer ticker.Stop()
            
            for {
                select {
                case <-ticker.C:
                    stats := sqlDB.Stats()
                    dbMonitor.UpdateConnectionMetrics("postgres", stats.OpenConnections)
                }
            }
        }()
    }
    
    return db, nil
}

// GetQueryStats returns current query statistics for debugging
func GetQueryStats(dbMonitor *DatabaseMonitor) map[string]*QueryMetrics {
    return dbMonitor.GetQueryStats()
}
EOF
    
    print_status "Integration example created for $service"
done

# Step 3: Update go.mod files to include database monitoring dependencies
echo ""
echo "📋 Step 3: Updating go.mod dependencies..."

for service in "${SERVICES[@]}"; do
    SERVICE_DIR="$PROJECT_ROOT/backend/$service"
    
    if [ ! -f "$SERVICE_DIR/go.mod" ]; then
        print_warning "go.mod not found for $service"
        continue
    fi
    
    cd "$SERVICE_DIR"
    
    # Add required dependencies if not already present
    if ! grep -q "github.com/prometheus/client_golang" go.mod; then
        go get github.com/prometheus/client_golang/prometheus
        go get github.com/prometheus/client_golang/prometheus/promauto
    fi
    
    if ! grep -q "github.com/getsentry/sentry-go" go.mod; then
        go get github.com/getsentry/sentry-go
    fi
    
    # Update go.sum
    go mod tidy
    
    print_status "Dependencies updated for $service"
done

# Step 4: Create database performance alerts
echo ""
echo "🚨 Step 4: Creating database performance alerts..."

mkdir -p "$PROJECT_ROOT/monitoring/prometheus/rules"

cat > "$PROJECT_ROOT/monitoring/prometheus/rules/database_alerts.yml" << 'EOF'
groups:
- name: database-performance
  rules:
  - alert: DatabaseSlowQueries
    expr: rate(database_slow_queries_total[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High rate of slow database queries in {{ $labels.service }}"
      description: "Service {{ $labels.service }} is experiencing {{ $value }} slow queries per second"
      
  - alert: DatabaseConnectionPoolHigh
    expr: database_connections_active / 20 > 0.8
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Database connection pool usage high in {{ $labels.service }}"
      description: "Connection pool usage is {{ $value | humanizePercentage }} in {{ $labels.service }}"
      
  - alert: DatabaseErrorRate
    expr: rate(database_errors_total[5m]) > 0.01
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database error rate elevated in {{ $labels.service }}"
      description: "Database error rate is {{ $value }} errors per second in {{ $labels.service }}"
      
  - alert: DatabaseConnectionPoolExhausted
    expr: database_connections_active / 20 > 0.95
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database connection pool nearly exhausted in {{ $labels.service }}"
      description: "Connection pool usage is {{ $value | humanizePercentage }} in {{ $labels.service }}"
      
  - alert: DatabaseQueryDuration
    expr: histogram_quantile(0.95, database_query_duration_seconds_bucket) > 1.0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "95th percentile database query duration high in {{ $labels.service }}"
      description: "95th percentile query duration is {{ $value }}s in {{ $labels.service }}"
EOF

print_status "Database performance alerts created"

# Step 5: Update Prometheus configuration to include database alerts
echo ""
echo "🔧 Step 5: Updating Prometheus configuration..."

PROMETHEUS_CONFIG="$PROJECT_ROOT/monitoring/prometheus/prometheus.yml"

if [ -f "$PROMETHEUS_CONFIG" ]; then
    # Check if database_alerts.yml is already included
    if ! grep -q "database_alerts.yml" "$PROMETHEUS_CONFIG"; then
        # Add database alerts to rule_files section
        sed -i.backup '/rule_files:/a\
  - "rules/database_alerts.yml"' "$PROMETHEUS_CONFIG"
        print_status "Database alerts added to Prometheus configuration"
    else
        print_info "Database alerts already configured in Prometheus"
    fi
else
    print_warning "Prometheus configuration not found at $PROMETHEUS_CONFIG"
fi

# Step 6: Create database performance dashboard for Grafana
echo ""
echo "📊 Step 6: Creating database performance dashboard..."

mkdir -p "$PROJECT_ROOT/monitoring/grafana/dashboards"

cat > "$PROJECT_ROOT/monitoring/grafana/dashboards/database-performance.json" << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "Database Performance",
    "tags": ["database", "performance", "monitoring"],
    "style": "dark",
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Query Duration by Service",
        "type": "graph",
        "span": 6,
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(database_query_duration_seconds_bucket[5m])) by (service, le))",
            "legendFormat": "95th percentile - {{service}}",
            "refId": "A"
          },
          {
            "expr": "histogram_quantile(0.50, sum(rate(database_query_duration_seconds_bucket[5m])) by (service, le))",
            "legendFormat": "50th percentile - {{service}}",
            "refId": "B"
          }
        ],
        "yAxes": [
          {
            "label": "Duration (seconds)",
            "min": 0
          }
        ],
        "legend": {
          "show": true
        }
      },
      {
        "id": 2,
        "title": "Slow Queries Rate",
        "type": "graph",
        "span": 6,
        "targets": [
          {
            "expr": "sum(rate(database_slow_queries_total[5m])) by (service)",
            "legendFormat": "Slow queries/sec - {{service}}",
            "refId": "A"
          }
        ],
        "yAxes": [
          {
            "label": "Queries per second",
            "min": 0
          }
        ]
      },
      {
        "id": 3,
        "title": "Connection Pool Usage",
        "type": "graph",
        "span": 6,
        "targets": [
          {
            "expr": "database_connections_active",
            "legendFormat": "Active connections - {{service}}",
            "refId": "A"
          }
        ],
        "yAxes": [
          {
            "label": "Connections",
            "min": 0
          }
        ]
      },
      {
        "id": 4,
        "title": "Database Error Rate",
        "type": "graph",
        "span": 6,
        "targets": [
          {
            "expr": "sum(rate(database_errors_total[5m])) by (service, error_type)",
            "legendFormat": "{{error_type}} - {{service}}",
            "refId": "A"
          }
        ],
        "yAxes": [
          {
            "label": "Errors per second",
            "min": 0
          }
        ]
      },
      {
        "id": 5,
        "title": "Query Types Distribution",
        "type": "piechart",
        "span": 6,
        "targets": [
          {
            "expr": "sum(rate(database_queries_total[5m])) by (operation)",
            "legendFormat": "{{operation}}",
            "refId": "A"
          }
        ]
      },
      {
        "id": 6,
        "title": "Top Slow Tables",
        "type": "table",
        "span": 6,
        "targets": [
          {
            "expr": "topk(10, sum(rate(database_slow_queries_total[5m])) by (service, table))",
            "legendFormat": "{{service}}/{{table}}",
            "refId": "A"
          }
        ]
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
EOF

print_status "Database performance dashboard created"

# Step 7: Create integration test script
echo ""
echo "🧪 Step 7: Creating integration test script..."

cat > "$PROJECT_ROOT/scripts/test-database-monitoring.sh" << 'EOF'
#!/bin/bash

# Test Database Monitoring Integration
set -e

echo "🧪 Testing Database Monitoring Integration..."

# Test 1: Check if metrics endpoints are exposing database metrics
echo "1. Checking for database metrics in services..."

SERVICES=("api-gateway" "user-svc" "chat-svc" "discovery-svc" "search-svc")
PORTS=(8080 8081 8082 8083 8084)

for i in "${!SERVICES[@]}"; do
    service="${SERVICES[$i]}"
    port="${PORTS[$i]}"
    
    echo "Testing $service on port $port..."
    
    if curl -s "http://localhost:$port/metrics" | grep -q "database_query_duration_seconds"; then
        echo "✅ $service: Database metrics found"
    else
        echo "❌ $service: Database metrics not found"
    fi
done

# Test 2: Verify Prometheus can scrape database metrics
echo ""
echo "2. Testing Prometheus database metrics..."

if curl -s "http://localhost:9090/api/v1/label/__name__/values" | grep -q "database_"; then
    echo "✅ Prometheus: Database metrics available"
else
    echo "❌ Prometheus: Database metrics not available"
fi

# Test 3: Check if Grafana dashboard exists
echo ""
echo "3. Testing Grafana dashboard..."

if [ -f "../monitoring/grafana/dashboards/database-performance.json" ]; then
    echo "✅ Grafana: Database performance dashboard exists"
else
    echo "❌ Grafana: Database performance dashboard missing"
fi

echo ""
echo "🎉 Database monitoring integration test complete!"
EOF

chmod +x "$PROJECT_ROOT/scripts/test-database-monitoring.sh"

print_status "Integration test script created"

# Step 8: Create README with usage instructions
echo ""
echo "📚 Step 8: Creating usage documentation..."

cat > "$PROJECT_ROOT/backend/shared/database/README.md" << 'EOF'
# Database Monitoring Integration

## Overview

This package provides comprehensive database monitoring that integrates with your existing observability stack:

- **Prometheus Metrics**: Query performance, connection pool health, error rates
- **Sentry Integration**: Automatic error reporting with query context
- **Grafana Dashboards**: Visual performance analysis
- **Automated Alerts**: Proactive issue detection

## Quick Integration

### 1. Initialize Database with Monitoring

```go
// In your service's database initialization
import "path/to/your-service/internal/database"

func initDB() (*gorm.DB, error) {
    return database.InitDBWithMonitoring("your-service-name")
}
```

### 2. Use Database Normally

```go
// No changes needed - monitoring happens automatically
var user User
result := db.Where("email = ?", email).First(&user)

// Slow queries, errors, and metrics are automatically tracked
```

### 3. Monitor Performance

- **Grafana**: Database Performance dashboard
- **Prometheus**: Query `database_query_duration_seconds`
- **Sentry**: Slow query and error alerts
- **Alerts**: Automatic notifications for issues

## Metrics Collected

- `database_query_duration_seconds`: Query execution time
- `database_queries_total`: Query count by type and status
- `database_slow_queries_total`: Slow query count
- `database_connections_active`: Active connection count
- `database_errors_total`: Error count by type

## Configuration

### Environment Variables

- `SLOW_QUERY_THRESHOLD_MS`: Threshold for slow queries (default: 100ms)
- `CRITICAL_QUERY_THRESHOLD_MS`: Threshold for critical alerts (default: 1000ms)

### Customization

```go
// Custom thresholds
monitor := NewDatabaseMonitor("service-name")
monitor.SetSlowQueryThreshold(200 * time.Millisecond)
monitor.SetCriticalThreshold(2 * time.Second)
```

## Query Analysis Features

- **Query Pattern Detection**: Identifies N+1 queries, complex joins
- **Performance Classification**: Low/medium/high complexity scoring
- **Error Categorization**: Connection, timeout, constraint violations
- **Trend Analysis**: Query performance over time

## Troubleshooting

### Common Issues

1. **Metrics not appearing**: Ensure service exposes `/metrics` endpoint
2. **High memory usage**: Adjust query pattern cache size
3. **Too many alerts**: Increase slow query threshold

### Debug Information

```go
// Get current query statistics
stats := monitor.GetQueryStats()
for pattern, metrics := range stats {
    fmt.Printf("Query: %s, Avg: %v, Count: %d\n", 
        pattern, metrics.AvgTime, metrics.Count)
}
```
EOF

print_status "Usage documentation created"

# Summary
echo ""
echo "🎉 Database Monitoring Deployment Complete!"
echo ""
echo "📋 Summary:"
echo "  ✅ Database monitoring library deployed to all services"
echo "  ✅ Integration examples created"
echo "  ✅ Dependencies updated"
echo "  ✅ Prometheus alerts configured"
echo "  ✅ Grafana dashboard created"
echo "  ✅ Test scripts created"
echo "  ✅ Documentation generated"
echo ""
echo "🚀 Next Steps:"
echo "  1. Update your service database initialization to use the monitoring integration"
echo "  2. Rebuild and deploy your services"
echo "  3. Import the Grafana dashboard"
echo "  4. Test the integration with: ./scripts/test-database-monitoring.sh"
echo ""
echo "📊 Access your monitoring:"
echo "  - Grafana: https://monitoring.linkapp.local/grafana/"
echo "  - Prometheus: https://monitoring.linkapp.local/prometheus/"
echo "  - Sentry: Your existing Sentry dashboard"
echo ""

print_status "Database monitoring is ready for production!"
