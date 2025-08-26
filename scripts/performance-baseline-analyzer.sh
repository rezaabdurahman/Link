#!/bin/bash

# Performance Baseline Analyzer
# Analyzes performance metrics and generates baseline recommendations
# Integrates with existing K6 load testing and Prometheus monitoring

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="link-services"
PROMETHEUS_URL="http://localhost:9090"
OUTPUT_DIR="$PROJECT_ROOT/reports/performance-baselines"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Performance baseline targets
declare -A PERFORMANCE_TARGETS=(
    ["latency_p95_ms"]=500
    ["latency_p99_ms"]=2000
    ["error_rate_percent"]=1.0
    ["cpu_utilization_percent"]=80.0
    ["memory_utilization_percent"]=85.0
    ["availability_percent"]=99.9
    ["requests_per_second"]=100
    ["database_query_p95_ms"]=250
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is available and cluster is accessible
    if ! kubectl cluster-info &>/dev/null; then
        log_error "kubectl not available or cluster not accessible"
        exit 1
    fi
    
    # Check if Prometheus is accessible
    if ! curl -s "$PROMETHEUS_URL/api/v1/status/config" &>/dev/null; then
        log_warning "Prometheus not accessible at $PROMETHEUS_URL"
        log_info "Attempting to port-forward to Prometheus..."
        kubectl port-forward -n monitoring svc/prometheus 9090:9090 &>/dev/null &
        PROMETHEUS_PID=$!
        sleep 5
        if ! curl -s "$PROMETHEUS_URL/api/v1/status/config" &>/dev/null; then
            log_error "Cannot access Prometheus for metrics collection"
            exit 1
        fi
    fi
    
    # Ensure output directory exists
    mkdir -p "$OUTPUT_DIR"
    
    log_success "Prerequisites validated"
}

# Function to query Prometheus
query_prometheus() {
    local query="$1"
    local encoded_query=$(printf '%s' "$query" | jq -sRr @uri)
    curl -s "$PROMETHEUS_URL/api/v1/query?query=$encoded_query" | jq -r '.data.result[0].value[1] // "0"'
}

# Function to collect current performance metrics
collect_performance_metrics() {
    log_info "Collecting current performance metrics..."
    
    local metrics_file="$OUTPUT_DIR/current_metrics_$TIMESTAMP.json"
    
    cat > "$metrics_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "collection_period": "5m",
    "metrics": {
EOF

    # Latency metrics
    local latency_p95=$(query_prometheus "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace=\"$NAMESPACE\"}[5m])) by (service, le))")
    local latency_p99=$(query_prometheus "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace=\"$NAMESPACE\"}[5m])) by (service, le))")
    
    # Convert to milliseconds
    latency_p95_ms=$(echo "$latency_p95 * 1000" | bc -l | xargs printf "%.2f")
    latency_p99_ms=$(echo "$latency_p99 * 1000" | bc -l | xargs printf "%.2f")
    
    # Error rate
    local error_rate=$(query_prometheus "(sum(rate(http_requests_total{namespace=\"$NAMESPACE\", status=~\"5..\"}[5m])) / sum(rate(http_requests_total{namespace=\"$NAMESPACE\"}[5m]))) * 100")
    
    # Request rate
    local request_rate=$(query_prometheus "sum(rate(http_requests_total{namespace=\"$NAMESPACE\"}[5m]))")
    
    # Resource utilization
    local cpu_utilization=$(query_prometheus "avg(rate(container_cpu_usage_seconds_total{namespace=\"$NAMESPACE\"}[5m])) * 100")
    local memory_utilization=$(query_prometheus "avg(container_memory_working_set_bytes{namespace=\"$NAMESPACE\"} / container_spec_memory_limit_bytes{namespace=\"$NAMESPACE\"}) * 100")
    
    # Database metrics
    local db_query_p95=$(query_prometheus "histogram_quantile(0.95, sum(rate(pg_stat_statements_mean_exec_time_bucket[5m])) by (datname, le))")
    local db_connections=$(query_prometheus "(sum(pg_stat_database_numbackends) / sum(pg_settings_max_connections)) * 100")
    
    # Availability (7-day)
    local availability=$(query_prometheus "(1 - (sum(rate(http_requests_total{namespace=\"$NAMESPACE\", status=~\"5..\"}[7d])) / sum(rate(http_requests_total{namespace=\"$NAMESPACE\"}[7d])))) * 100")
    
cat >> "$metrics_file" << EOF
        "latency": {
            "p95_ms": $latency_p95_ms,
            "p99_ms": $latency_p99_ms,
            "target_p95_ms": ${PERFORMANCE_TARGETS[latency_p95_ms]},
            "target_p99_ms": ${PERFORMANCE_TARGETS[latency_p99_ms]}
        },
        "error_rate": {
            "current_percent": $error_rate,
            "target_percent": ${PERFORMANCE_TARGETS[error_rate_percent]}
        },
        "throughput": {
            "requests_per_second": $request_rate,
            "target_requests_per_second": ${PERFORMANCE_TARGETS[requests_per_second]}
        },
        "resources": {
            "cpu_utilization_percent": $cpu_utilization,
            "memory_utilization_percent": $memory_utilization,
            "cpu_target_percent": ${PERFORMANCE_TARGETS[cpu_utilization_percent]},
            "memory_target_percent": ${PERFORMANCE_TARGETS[memory_utilization_percent]}
        },
        "database": {
            "query_p95_ms": $db_query_p95,
            "connections_utilization_percent": $db_connections,
            "target_query_p95_ms": ${PERFORMANCE_TARGETS[database_query_p95_ms]}
        },
        "availability": {
            "current_percent": $availability,
            "target_percent": ${PERFORMANCE_TARGETS[availability_percent]}
        }
    }
}
EOF

    log_success "Performance metrics collected: $metrics_file"
    echo "$metrics_file"
}

# Function to analyze performance against baselines
analyze_performance() {
    local metrics_file="$1"
    log_info "Analyzing performance against baselines..."
    
    local analysis_file="$OUTPUT_DIR/performance_analysis_$TIMESTAMP.json"
    
    # Read current metrics
    local latency_p95=$(jq -r '.metrics.latency.p95_ms' "$metrics_file")
    local latency_p99=$(jq -r '.metrics.latency.p99_ms' "$metrics_file")
    local error_rate=$(jq -r '.metrics.error_rate.current_percent' "$metrics_file")
    local cpu_util=$(jq -r '.metrics.resources.cpu_utilization_percent' "$metrics_file")
    local memory_util=$(jq -r '.metrics.resources.memory_utilization_percent' "$metrics_file")
    local availability=$(jq -r '.metrics.availability.current_percent' "$metrics_file")
    local request_rate=$(jq -r '.metrics.throughput.requests_per_second' "$metrics_file")
    local db_query_p95=$(jq -r '.metrics.database.query_p95_ms' "$metrics_file")
    
    # Calculate compliance
    local latency_p95_compliant="false"
    local latency_p99_compliant="false"
    local error_rate_compliant="false"
    local cpu_compliant="false"
    local memory_compliant="false"
    local availability_compliant="false"
    local throughput_compliant="false"
    local db_compliant="false"
    
    # Check compliance (using bc for floating point comparison)
    if (( $(echo "$latency_p95 <= ${PERFORMANCE_TARGETS[latency_p95_ms]}" | bc -l) )); then
        latency_p95_compliant="true"
    fi
    if (( $(echo "$latency_p99 <= ${PERFORMANCE_TARGETS[latency_p99_ms]}" | bc -l) )); then
        latency_p99_compliant="true"
    fi
    if (( $(echo "$error_rate <= ${PERFORMANCE_TARGETS[error_rate_percent]}" | bc -l) )); then
        error_rate_compliant="true"
    fi
    if (( $(echo "$cpu_util <= ${PERFORMANCE_TARGETS[cpu_utilization_percent]}" | bc -l) )); then
        cpu_compliant="true"
    fi
    if (( $(echo "$memory_util <= ${PERFORMANCE_TARGETS[memory_utilization_percent]}" | bc -l) )); then
        memory_compliant="true"
    fi
    if (( $(echo "$availability >= ${PERFORMANCE_TARGETS[availability_percent]}" | bc -l) )); then
        availability_compliant="true"
    fi
    if (( $(echo "$request_rate >= ${PERFORMANCE_TARGETS[requests_per_second]}" | bc -l) )); then
        throughput_compliant="true"
    fi
    if (( $(echo "$db_query_p95 <= ${PERFORMANCE_TARGETS[database_query_p95_ms]}" | bc -l) )); then
        db_compliant="true"
    fi
    
    # Calculate overall compliance score
    local compliant_count=0
    local total_checks=8
    
    [[ "$latency_p95_compliant" == "true" ]] && ((compliant_count++))
    [[ "$latency_p99_compliant" == "true" ]] && ((compliant_count++))
    [[ "$error_rate_compliant" == "true" ]] && ((compliant_count++))
    [[ "$cpu_compliant" == "true" ]] && ((compliant_count++))
    [[ "$memory_compliant" == "true" ]] && ((compliant_count++))
    [[ "$availability_compliant" == "true" ]] && ((compliant_count++))
    [[ "$throughput_compliant" == "true" ]] && ((compliant_count++))
    [[ "$db_compliant" == "true" ]] && ((compliant_count++))
    
    local compliance_score=$(echo "scale=1; $compliant_count * 100 / $total_checks" | bc -l)
    
cat > "$analysis_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "analysis": {
        "overall_compliance_score": $compliance_score,
        "compliant_checks": $compliant_count,
        "total_checks": $total_checks,
        "baseline_checks": {
            "latency_p95": {
                "compliant": $latency_p95_compliant,
                "current": $latency_p95,
                "target": ${PERFORMANCE_TARGETS[latency_p95_ms]},
                "variance_percent": $(echo "scale=1; ($latency_p95 - ${PERFORMANCE_TARGETS[latency_p95_ms]}) * 100 / ${PERFORMANCE_TARGETS[latency_p95_ms]}" | bc -l)
            },
            "latency_p99": {
                "compliant": $latency_p99_compliant,
                "current": $latency_p99,
                "target": ${PERFORMANCE_TARGETS[latency_p99_ms]},
                "variance_percent": $(echo "scale=1; ($latency_p99 - ${PERFORMANCE_TARGETS[latency_p99_ms]}) * 100 / ${PERFORMANCE_TARGETS[latency_p99_ms]}" | bc -l)
            },
            "error_rate": {
                "compliant": $error_rate_compliant,
                "current": $error_rate,
                "target": ${PERFORMANCE_TARGETS[error_rate_percent]},
                "variance_percent": $(echo "scale=1; ($error_rate - ${PERFORMANCE_TARGETS[error_rate_percent]}) * 100 / ${PERFORMANCE_TARGETS[error_rate_percent]}" | bc -l)
            },
            "cpu_utilization": {
                "compliant": $cpu_compliant,
                "current": $cpu_util,
                "target": ${PERFORMANCE_TARGETS[cpu_utilization_percent]},
                "variance_percent": $(echo "scale=1; ($cpu_util - ${PERFORMANCE_TARGETS[cpu_utilization_percent]}) * 100 / ${PERFORMANCE_TARGETS[cpu_utilization_percent]}" | bc -l)
            },
            "memory_utilization": {
                "compliant": $memory_compliant,
                "current": $memory_util,
                "target": ${PERFORMANCE_TARGETS[memory_utilization_percent]},
                "variance_percent": $(echo "scale=1; ($memory_util - ${PERFORMANCE_TARGETS[memory_utilization_percent]}) * 100 / ${PERFORMANCE_TARGETS[memory_utilization_percent]}" | bc -l)
            },
            "availability": {
                "compliant": $availability_compliant,
                "current": $availability,
                "target": ${PERFORMANCE_TARGETS[availability_percent]},
                "variance_percent": $(echo "scale=1; ($availability - ${PERFORMANCE_TARGETS[availability_percent]}) * 100 / ${PERFORMANCE_TARGETS[availability_percent]}" | bc -l)
            },
            "throughput": {
                "compliant": $throughput_compliant,
                "current": $request_rate,
                "target": ${PERFORMANCE_TARGETS[requests_per_second]},
                "variance_percent": $(echo "scale=1; ($request_rate - ${PERFORMANCE_TARGETS[requests_per_second]}) * 100 / ${PERFORMANCE_TARGETS[requests_per_second]}" | bc -l)
            },
            "database_performance": {
                "compliant": $db_compliant,
                "current": $db_query_p95,
                "target": ${PERFORMANCE_TARGETS[database_query_p95_ms]},
                "variance_percent": $(echo "scale=1; ($db_query_p95 - ${PERFORMANCE_TARGETS[database_query_p95_ms]}) * 100 / ${PERFORMANCE_TARGETS[database_query_p95_ms]}" | bc -l)
            }
        }
    }
}
EOF

    log_success "Performance analysis completed: $analysis_file"
    echo "$analysis_file"
}

# Function to generate recommendations
generate_recommendations() {
    local analysis_file="$1"
    log_info "Generating performance optimization recommendations..."
    
    local recommendations_file="$OUTPUT_DIR/recommendations_$TIMESTAMP.json"
    
    # Read analysis results
    local compliance_score=$(jq -r '.analysis.overall_compliance_score' "$analysis_file")
    
    # Check which metrics are non-compliant
    local latency_p95_compliant=$(jq -r '.analysis.baseline_checks.latency_p95.compliant' "$analysis_file")
    local latency_p99_compliant=$(jq -r '.analysis.baseline_checks.latency_p99.compliant' "$analysis_file")
    local error_rate_compliant=$(jq -r '.analysis.baseline_checks.error_rate.compliant' "$analysis_file")
    local cpu_compliant=$(jq -r '.analysis.baseline_checks.cpu_utilization.compliant' "$analysis_file")
    local memory_compliant=$(jq -r '.analysis.baseline_checks.memory_utilization.compliant' "$analysis_file")
    local availability_compliant=$(jq -r '.analysis.baseline_checks.availability.compliant' "$analysis_file")
    local throughput_compliant=$(jq -r '.analysis.baseline_checks.throughput.compliant' "$analysis_file")
    local db_compliant=$(jq -r '.analysis.baseline_checks.database_performance.compliant' "$analysis_file")
    
    cat > "$recommendations_file" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "overall_assessment": {
        "compliance_score": $compliance_score,
        "status": "$(if (( $(echo "$compliance_score >= 90" | bc -l) )); then echo "excellent"; elif (( $(echo "$compliance_score >= 75" | bc -l) )); then echo "good"; elif (( $(echo "$compliance_score >= 60" | bc -l) )); then echo "needs_improvement"; else echo "critical"; fi)"
    },
    "recommendations": [
EOF

    local recommendations=()
    
    # Latency recommendations
    if [[ "$latency_p95_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "high",
            "category": "latency",
            "issue": "P95 latency exceeds 500ms baseline",
            "recommendation": "Optimize API response times through database query optimization, caching implementation, and code profiling",
            "actions": [
                "Review slow database queries in pg_stat_statements",
                "Implement Redis caching for frequently accessed data",
                "Profile application code for performance bottlenecks",
                "Consider CDN for static assets",
                "Optimize database indexes"
            ],
            "expected_impact": "Reduce P95 latency by 30-50%"
        }')
    fi
    
    if [[ "$latency_p99_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "high",
            "category": "latency",
            "issue": "P99 latency exceeds 2s baseline - affecting user experience",
            "recommendation": "Address tail latency issues through timeout optimization and connection pooling",
            "actions": [
                "Implement request timeouts and circuit breakers",
                "Optimize database connection pooling",
                "Review garbage collection settings",
                "Implement async processing for heavy operations",
                "Monitor and optimize external service calls"
            ],
            "expected_impact": "Reduce P99 latency by 40-60%"
        }')
    fi
    
    # Error rate recommendations
    if [[ "$error_rate_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "critical",
            "category": "reliability",
            "issue": "Error rate exceeds 1% baseline - impacting availability SLO",
            "recommendation": "Implement comprehensive error handling and monitoring",
            "actions": [
                "Analyze error patterns and root causes",
                "Implement retry logic with exponential backoff",
                "Add comprehensive logging and alerting",
                "Review and fix application bugs",
                "Implement health checks and graceful degradation"
            ],
            "expected_impact": "Reduce error rate to <0.5%"
        }')
    fi
    
    # Resource utilization recommendations
    if [[ "$cpu_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "medium",
            "category": "resources",
            "issue": "CPU utilization exceeds 80% baseline",
            "recommendation": "Optimize CPU usage and consider horizontal scaling",
            "actions": [
                "Profile CPU-intensive operations",
                "Implement horizontal pod autoscaling",
                "Optimize algorithms and data structures",
                "Consider CPU request/limit adjustments",
                "Review and optimize background processes"
            ],
            "expected_impact": "Reduce CPU utilization by 20-30%"
        }')
    fi
    
    if [[ "$memory_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "medium",
            "category": "resources",
            "issue": "Memory utilization exceeds 85% baseline",
            "recommendation": "Optimize memory usage and prevent memory leaks",
            "actions": [
                "Profile memory usage patterns",
                "Implement memory-efficient data structures",
                "Check for memory leaks",
                "Optimize garbage collection settings",
                "Consider memory limit adjustments"
            ],
            "expected_impact": "Reduce memory utilization by 15-25%"
        }')
    fi
    
    # Availability recommendations
    if [[ "$availability_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "critical",
            "category": "availability",
            "issue": "Availability below 99.9% SLO target",
            "recommendation": "Implement high availability patterns and improve system resilience",
            "actions": [
                "Implement multi-zone deployment",
                "Add comprehensive health checks",
                "Implement graceful shutdown procedures",
                "Review and improve monitoring/alerting",
                "Implement automatic failover mechanisms"
            ],
            "expected_impact": "Achieve >99.9% availability"
        }')
    fi
    
    # Throughput recommendations
    if [[ "$throughput_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "medium",
            "category": "scalability",
            "issue": "Request throughput below expected baseline",
            "recommendation": "Optimize system throughput and scalability",
            "actions": [
                "Implement load balancing improvements",
                "Optimize connection pooling",
                "Consider async processing patterns",
                "Review bottlenecks in request processing",
                "Implement horizontal scaling"
            ],
            "expected_impact": "Increase throughput by 50-100%"
        }')
    fi
    
    # Database recommendations
    if [[ "$db_compliant" == "false" ]]; then
        recommendations+=('
        {
            "priority": "high",
            "category": "database",
            "issue": "Database query performance below baseline",
            "recommendation": "Optimize database performance through query and schema optimization",
            "actions": [
                "Analyze and optimize slow queries",
                "Review and add missing database indexes",
                "Implement query result caching",
                "Consider read replicas for scaling",
                "Optimize database configuration"
            ],
            "expected_impact": "Reduce query latency by 40-60%"
        }')
    fi
    
    # Add general recommendations if everything is compliant
    if (( $(echo "$compliance_score >= 90" | bc -l) )); then
        recommendations+=('
        {
            "priority": "low",
            "category": "optimization",
            "issue": "Performance baselines met - focus on optimization",
            "recommendation": "Continue monitoring and implement proactive optimizations",
            "actions": [
                "Implement performance regression testing",
                "Set up automated performance monitoring",
                "Plan capacity based on growth projections",
                "Consider cost optimization opportunities",
                "Implement SLO monitoring and alerting"
            ],
            "expected_impact": "Maintain excellent performance standards"
        }')
    fi
    
    # Join recommendations with commas
    local recommendations_json=$(printf "%s" "${recommendations[@]}" | paste -sd ',' -)
    
    cat >> "$recommendations_file" << EOF
$recommendations_json
    ],
    "next_steps": {
        "immediate_actions": [
            "Review critical and high priority recommendations",
            "Implement monitoring for non-compliant metrics", 
            "Schedule performance optimization sprint"
        ],
        "monitoring_improvements": [
            "Set up automated baseline monitoring",
            "Implement SLO alerting for key metrics",
            "Create performance dashboards",
            "Schedule regular performance reviews"
        ],
        "long_term_goals": [
            "Achieve >90% baseline compliance",
            "Implement automated performance regression detection",
            "Establish performance culture and best practices"
        ]
    }
}
EOF

    log_success "Recommendations generated: $recommendations_file"
    echo "$recommendations_file"
}

# Function to generate HTML report
generate_html_report() {
    local metrics_file="$1"
    local analysis_file="$2"
    local recommendations_file="$3"
    
    log_info "Generating HTML performance report..."
    
    local html_report="$OUTPUT_DIR/performance_baseline_report_$TIMESTAMP.html"
    
    # Read data from JSON files
    local compliance_score=$(jq -r '.analysis.overall_compliance_score' "$analysis_file")
    local status=$(jq -r '.overall_assessment.status' "$recommendations_file")
    
    cat > "$html_report" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Platform - Performance Baseline Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; text-align: center; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .subtitle { font-size: 1.2em; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .summary-card h3 { color: #555; margin-bottom: 15px; font-size: 1.1em; text-transform: uppercase; letter-spacing: 1px; }
        .summary-card .metric { font-size: 2.5em; font-weight: bold; margin-bottom: 10px; }
        .summary-card .status { padding: 8px 16px; border-radius: 20px; font-weight: bold; text-transform: uppercase; font-size: 0.9em; }
        .status.excellent { background: #d4edda; color: #155724; }
        .status.good { background: #d1ecf1; color: #0c5460; }
        .status.needs_improvement { background: #fff3cd; color: #856404; }
        .status.critical { background: #f8d7da; color: #721c24; }
        .section { background: white; margin-bottom: 30px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .section-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #e9ecef; }
        .section-header h2 { color: #495057; margin-bottom: 5px; }
        .section-content { padding: 25px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-item { padding: 15px; border-left: 4px solid #dee2e6; background: #f8f9fa; border-radius: 0 5px 5px 0; }
        .metric-item.compliant { border-left-color: #28a745; background: #d4edda; }
        .metric-item.non-compliant { border-left-color: #dc3545; background: #f8d7da; }
        .metric-item .name { font-weight: bold; margin-bottom: 8px; color: #495057; }
        .metric-item .values { display: flex; justify-content: space-between; align-items: center; }
        .metric-item .current { font-size: 1.3em; font-weight: bold; }
        .metric-item .target { color: #6c757d; font-size: 0.9em; }
        .recommendations { list-style: none; }
        .recommendation { background: #f8f9fa; margin: 15px 0; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        .recommendation.high { border-left-color: #dc3545; }
        .recommendation.medium { border-left-color: #ffc107; }
        .recommendation.critical { border-left-color: #6f42c1; }
        .recommendation .priority { display: inline-block; padding: 4px 8px; border-radius: 3px; font-size: 0.8em; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
        .priority.critical { background: #6f42c1; color: white; }
        .priority.high { background: #dc3545; color: white; }
        .priority.medium { background: #ffc107; color: #000; }
        .priority.low { background: #28a745; color: white; }
        .recommendation h4 { margin-bottom: 10px; color: #495057; }
        .recommendation p { margin-bottom: 15px; color: #6c757d; }
        .recommendation .actions { margin-top: 15px; }
        .recommendation .actions h5 { margin-bottom: 8px; color: #495057; font-size: 0.9em; }
        .recommendation .actions ul { margin-left: 20px; }
        .recommendation .actions li { margin-bottom: 5px; color: #6c757d; }
        .footer { text-align: center; padding: 30px; color: #6c757d; }
        .timestamp { font-size: 0.9em; color: #6c757d; }
        @media (max-width: 768px) {
            .container { padding: 15px; }
            .header { padding: 20px; }
            .header h1 { font-size: 2em; }
            .metrics-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>🚀 Performance Baseline Report</h1>
            <p class="subtitle">Link Platform Performance Analysis & Recommendations</p>
            <p class="timestamp">Generated: $(date)</p>
        </header>

        <div class="summary">
            <div class="summary-card">
                <h3>Overall Compliance</h3>
                <div class="metric">${compliance_score}%</div>
                <span class="status ${status}">${status//_/ }</span>
            </div>
EOF

    # Add metric summary cards
    local latency_p95=$(jq -r '.metrics.latency.p95_ms' "$metrics_file")
    local error_rate=$(jq -r '.metrics.error_rate.current_percent' "$metrics_file")
    local availability=$(jq -r '.metrics.availability.current_percent' "$metrics_file")
    local request_rate=$(jq -r '.metrics.throughput.requests_per_second' "$metrics_file")

    cat >> "$html_report" << EOF
            <div class="summary-card">
                <h3>P95 Latency</h3>
                <div class="metric">${latency_p95}ms</div>
                <span class="status $(if (( $(echo "$latency_p95 <= 500" | bc -l) )); then echo "excellent"; else echo "needs_improvement"; fi)">
                    $(if (( $(echo "$latency_p95 <= 500" | bc -l) )); then echo "Within Target"; else echo "Above Target"; fi)
                </span>
            </div>
            <div class="summary-card">
                <h3>Error Rate</h3>
                <div class="metric">${error_rate}%</div>
                <span class="status $(if (( $(echo "$error_rate <= 1" | bc -l) )); then echo "excellent"; else echo "critical"; fi)">
                    $(if (( $(echo "$error_rate <= 1" | bc -l) )); then echo "Within Target"; else echo "Above Target"; fi)
                </span>
            </div>
            <div class="summary-card">
                <h3>Availability</h3>
                <div class="metric">${availability}%</div>
                <span class="status $(if (( $(echo "$availability >= 99.9" | bc -l) )); then echo "excellent"; else echo "needs_improvement"; fi)">
                    $(if (( $(echo "$availability >= 99.9" | bc -l) )); then echo "SLO Met"; else echo "Below SLO"; fi)
                </span>
            </div>
        </div>

        <section class="section">
            <div class="section-header">
                <h2>📊 Baseline Compliance Analysis</h2>
                <p>Current performance metrics compared to established baselines</p>
            </div>
            <div class="section-content">
                <div class="metrics-grid">
EOF

    # Add detailed metrics from analysis
    local metrics=(
        "latency_p95:Latency P95:ms"
        "latency_p99:Latency P99:ms"
        "error_rate:Error Rate:%"
        "cpu_utilization:CPU Utilization:%"
        "memory_utilization:Memory Utilization:%"
        "availability:Availability:%"
        "throughput:Throughput:req/s"
        "database_performance:DB Query P95:ms"
    )

    for metric in "${metrics[@]}"; do
        IFS=':' read -r key name unit <<< "$metric"
        local compliant=$(jq -r ".analysis.baseline_checks.${key}.compliant" "$analysis_file")
        local current=$(jq -r ".analysis.baseline_checks.${key}.current" "$analysis_file")
        local target=$(jq -r ".analysis.baseline_checks.${key}.target" "$analysis_file")
        local variance=$(jq -r ".analysis.baseline_checks.${key}.variance_percent" "$analysis_file")
        
        cat >> "$html_report" << EOF
                    <div class="metric-item $(if [[ "$compliant" == "true" ]]; then echo "compliant"; else echo "non-compliant"; fi)">
                        <div class="name">${name}</div>
                        <div class="values">
                            <span class="current">${current}${unit}</span>
                            <span class="target">Target: ${target}${unit}</span>
                        </div>
                        <div class="variance">Variance: ${variance}%</div>
                    </div>
EOF
    done

    cat >> "$html_report" << 'EOF'
                </div>
            </div>
        </section>

        <section class="section">
            <div class="section-header">
                <h2>🎯 Performance Recommendations</h2>
                <p>Actionable recommendations to improve performance and meet baselines</p>
            </div>
            <div class="section-content">
                <ul class="recommendations">
EOF

    # Add recommendations
    local rec_count=$(jq '.recommendations | length' "$recommendations_file")
    for ((i=0; i<rec_count; i++)); do
        local priority=$(jq -r ".recommendations[$i].priority" "$recommendations_file")
        local category=$(jq -r ".recommendations[$i].category" "$recommendations_file")
        local issue=$(jq -r ".recommendations[$i].issue" "$recommendations_file")
        local recommendation=$(jq -r ".recommendations[$i].recommendation" "$recommendations_file")
        local expected_impact=$(jq -r ".recommendations[$i].expected_impact" "$recommendations_file")
        
        cat >> "$html_report" << EOF
                    <li class="recommendation $priority">
                        <span class="priority $priority">$priority Priority</span>
                        <h4>$issue</h4>
                        <p><strong>Recommendation:</strong> $recommendation</p>
                        <p><strong>Expected Impact:</strong> $expected_impact</p>
                        <div class="actions">
                            <h5>Action Items:</h5>
                            <ul>
EOF
        
        local action_count=$(jq ".recommendations[$i].actions | length" "$recommendations_file")
        for ((j=0; j<action_count; j++)); do
            local action=$(jq -r ".recommendations[$i].actions[$j]" "$recommendations_file")
            echo "                                <li>$action</li>" >> "$html_report"
        done
        
        cat >> "$html_report" << 'EOF'
                            </ul>
                        </div>
                    </li>
EOF
    done

    cat >> "$html_report" << 'EOF'
                </ul>
            </div>
        </section>

        <footer class="footer">
            <p>🔍 This report is generated automatically based on current performance metrics.</p>
            <p>For questions or concerns, contact the Platform Engineering team.</p>
        </footer>
    </div>
</body>
</html>
EOF

    log_success "HTML report generated: $html_report"
    echo "$html_report"
}

# Function to run load test and collect baseline data
run_load_test_baseline() {
    log_info "Running K6 load test to establish performance baseline..."
    
    # Check if K6 load test exists
    local k6_test_file="$PROJECT_ROOT/load-tests/performance-baseline-test.js"
    if [[ ! -f "$k6_test_file" ]]; then
        log_error "K6 performance baseline test not found: $k6_test_file"
        log_info "Please ensure K6 load testing is set up first"
        return 1
    fi
    
    # Run K6 test with baseline configuration
    log_info "Executing K6 load test..."
    cd "$PROJECT_ROOT/load-tests"
    k6 run --out prometheus=remoteURL=http://localhost:9091/metrics performance-baseline-test.js
    
    # Wait for metrics to be available in Prometheus
    log_info "Waiting for metrics to propagate to Prometheus..."
    sleep 30
    
    log_success "Load test baseline completed"
}

# Main execution function
main() {
    log_info "Starting Performance Baseline Analysis for Link Platform"
    log_info "========================================================"
    
    # Check if help is requested
    if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
        cat << EOF
Performance Baseline Analyzer

Usage: $0 [OPTIONS]

OPTIONS:
    --help, -h          Show this help message
    --load-test         Run K6 load test before analysis
    --prometheus-url    Prometheus URL (default: http://localhost:9090)
    --namespace         Kubernetes namespace (default: link-services)

Examples:
    $0                          # Run analysis with current metrics
    $0 --load-test             # Run load test then analysis
    $0 --prometheus-url http://prometheus.local:9090

Reports are generated in: $OUTPUT_DIR
EOF
        exit 0
    fi
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --load-test)
                RUN_LOAD_TEST=true
                shift
                ;;
            --prometheus-url)
                PROMETHEUS_URL="$2"
                shift 2
                ;;
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute analysis workflow
    check_prerequisites
    
    # Optionally run load test first
    if [[ "${RUN_LOAD_TEST:-false}" == "true" ]]; then
        run_load_test_baseline || log_warning "Load test failed, proceeding with current metrics"
    fi
    
    # Collect and analyze performance metrics
    local metrics_file
    metrics_file=$(collect_performance_metrics)
    
    local analysis_file
    analysis_file=$(analyze_performance "$metrics_file")
    
    local recommendations_file
    recommendations_file=$(generate_recommendations "$analysis_file")
    
    local html_report
    html_report=$(generate_html_report "$metrics_file" "$analysis_file" "$recommendations_file")
    
    # Clean up port-forward if we started it
    if [[ -n "${PROMETHEUS_PID:-}" ]]; then
        kill $PROMETHEUS_PID &>/dev/null || true
    fi
    
    # Summary
    log_success "Performance baseline analysis completed successfully!"
    echo
    log_info "Generated Reports:"
    log_info "  📊 Metrics: $metrics_file"
    log_info "  📈 Analysis: $analysis_file"
    log_info "  🎯 Recommendations: $recommendations_file"
    log_info "  📋 HTML Report: $html_report"
    echo
    log_info "Next Steps:"
    log_info "  1. Review the HTML report in your browser"
    log_info "  2. Implement high-priority recommendations"
    log_info "  3. Set up continuous baseline monitoring"
    log_info "  4. Schedule regular performance reviews"
    echo
    
    # Show compliance score
    local compliance_score=$(jq -r '.analysis.overall_compliance_score' "$analysis_file")
    if (( $(echo "$compliance_score >= 90" | bc -l) )); then
        log_success "🎉 Excellent! Performance baselines are being met ($compliance_score% compliance)"
    elif (( $(echo "$compliance_score >= 75" | bc -l) )); then
        log_info "✅ Good performance overall ($compliance_score% compliance) - minor optimizations recommended"
    elif (( $(echo "$compliance_score >= 60" | bc -l) )); then
        log_warning "⚠️ Performance needs improvement ($compliance_score% compliance) - review recommendations"
    else
        log_error "🚨 Critical performance issues detected ($compliance_score% compliance) - immediate action required"
    fi
}

# Execute main function with all arguments
main "$@"