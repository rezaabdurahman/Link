# Load Testing Suite

Comprehensive K6-based load testing for the Link application, covering all critical user journeys and performance scenarios.

## 🎯 Overview

This load testing suite provides:
- **Comprehensive User Journey Testing**: Registration, discovery, chat, search, and profile management flows
- **WebSocket Real-time Testing**: Chat functionality under concurrent load
- **Performance Baseline Validation**: SLO compliance and performance regression detection
- **Environment-specific Configuration**: Development, staging, and production scenarios
- **CI/CD Integration**: Automated testing in deployment pipelines

## 📁 Test Files

### Core Test Suites

| Test Suite | File | Purpose |
|------------|------|---------|
| **Basic Load Test** | `basic-load-test.js` | Simple API endpoint testing |
| **Frontend Load Test** | `frontend-load-test.js` | Frontend application performance |
| **Comprehensive Journeys** | `comprehensive-user-journeys.js` | Full user flow testing |
| **WebSocket Chat** | `websocket-chat-load-test.js` | Real-time chat functionality |
| **Performance Baseline** | `performance-baseline-test.js` | SLO validation and baselines |

### Supporting Files

| File | Purpose |
|------|---------|
| `k6-config.js` | Centralized configuration and utilities |
| `run-load-tests.sh` | Test execution script with reporting |
| `README.md` | This documentation |

## 🚀 Quick Start

### Prerequisites

1. Install K6:
```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# macOS
brew install k6

# Windows
choco install k6
```

2. Optional: Install jq for result parsing:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS  
brew install jq
```

### Running Tests

#### Using the Test Runner Script (Recommended)

```bash
# Run load test against development environment
./tests/load/run-load-tests.sh load development comprehensive

# Run stress test against staging
./tests/load/run-load-tests.sh stress staging all

# Run smoke test against production
./tests/load/run-load-tests.sh smoke production baseline

# Available scenarios: smoke, load, stress, spike, baseline
# Available environments: development, staging, production  
# Available suites: basic, frontend, comprehensive, websocket, baseline, all
```

#### Direct K6 Execution

```bash
# Comprehensive user journey test
k6 run --env SCENARIO=load --env TARGET_ENV=development tests/load/comprehensive-user-journeys.js

# WebSocket chat test
k6 run --env SCENARIO=stress --env TARGET_ENV=staging tests/load/websocket-chat-load-test.js

# Performance baseline validation
k6 run --env TARGET_ENV=production tests/load/performance-baseline-test.js
```

## 📊 Test Scenarios

### Scenario Types

| Scenario | Description | Duration | Virtual Users | Use Case |
|----------|-------------|----------|---------------|----------|
| **smoke** | Basic functionality verification | 30s | 1-2 | Sanity check |
| **load** | Normal production traffic | ~10min | 5-10 | Performance validation |
| **stress** | Beyond normal capacity | ~15min | 10-40 | Breaking point testing |
| **spike** | Sudden traffic increases | ~5min | 5-60 | Traffic spike handling |
| **soak** | Prolonged load testing | 1hr | 10 | Memory leak detection |
| **baseline** | SLO compliance validation | ~12min | 5-10 | Performance baselines |

### Environment Configuration

| Environment | API URL | Expected Performance |
|-------------|---------|---------------------|
| **Development** | `localhost:8080` | P95 < 500ms, 95% uptime |
| **Staging** | `api-staging.link-app.com` | P95 < 300ms, 99% uptime |
| **Production** | `api.link-app.com` | P95 < 200ms, 99.9% uptime |

## 🎯 Test Coverage

### User Journey Tests

#### 🚀 Registration Journey (10% of traffic)
1. Load registration page
2. Create new user account  
3. Complete onboarding process
4. **SLO Target**: 95% success rate, <3s completion

#### 🔍 Discovery Journey (40% of traffic)
1. User authentication
2. Load discovery page
3. Fetch nearby users
4. Update availability status
5. Evaluate feature flags
6. **SLO Target**: 97% success rate, <2s load time

#### 💬 Chat Journey (25% of traffic)
1. User authentication
2. Load chat interface
3. Retrieve conversations
4. Send messages
5. AI conversation summaries
6. **SLO Target**: 99% message delivery, <1s response

#### 🔎 Search Journey (15% of traffic)
1. User authentication
2. Perform user search
3. Advanced filtered search
4. Health check validation
5. **SLO Target**: <2s search response, accurate results

#### 👤 Profile Journey (10% of traffic)
1. User authentication
2. Load profile page
3. Fetch profile data
4. Update profile information
5. Modify privacy settings
6. **SLO Target**: <1s profile loads, 100% data integrity

### WebSocket Testing

#### Real-time Chat Simulation
- **Connection Types**: Active chatters, occasional users, lurkers, typing indicators
- **Message Patterns**: Realistic message templates and response behaviors
- **Load Patterns**: Concurrent connections, message throughput, connection stability
- **SLO Targets**: <5% connection errors, <1s message delivery

### Performance Baseline Testing

#### SLO Validation
- **API Availability**: Environment-specific uptime targets
- **Response Times**: P95 latency thresholds
- **Error Rates**: Acceptable failure rates
- **User Journey Success**: End-to-end completion rates

## 📈 Metrics and SLOs

### Key Performance Indicators

#### HTTP Metrics
- `http_req_duration`: Response time distribution
- `http_req_failed`: Request failure rate
- `http_reqs`: Request throughput

#### SLO-specific Metrics
- `slo_api_availability`: API uptime percentage
- `slo_api_latency_p95`: 95th percentile response time
- `slo_frontend_availability`: Frontend uptime percentage
- `journey_success`: User journey completion rate

#### WebSocket Metrics
- `ws_connection_errors`: WebSocket connection failure rate
- `ws_connection_duration`: Time to establish connection
- `message_delivery_duration`: End-to-end message delivery time
- `active_ws_connections`: Concurrent WebSocket connections

#### Custom Journey Metrics
- `authentication_duration`: Login/registration response time
- `discovery_load_duration`: Discovery page load time
- `search_response_duration`: Search API response time
- `ai_summary_duration`: AI service response time

### SLO Thresholds

#### Production Targets
- **Availability**: 99.9% uptime
- **API Latency**: P95 < 200ms
- **Frontend Load**: P95 < 1.5s
- **Error Rate**: < 0.1%
- **Journey Success**: > 95%

#### Staging Targets
- **Availability**: 99% uptime
- **API Latency**: P95 < 300ms
- **Frontend Load**: P95 < 2s
- **Error Rate**: < 2%
- **Journey Success**: > 90%

## 🔄 CI/CD Integration

### Pre-Deployment Testing
- **Trigger**: Before infrastructure deployment
- **Scenario**: Smoke tests
- **Purpose**: Verify environment readiness
- **Failure Action**: Block deployment

### Post-Deployment Validation
- **Trigger**: After application deployment
- **Scenario**: Load or stress tests
- **Purpose**: Validate deployment success
- **Failure Action**: Trigger rollback

### Continuous Testing
- **Trigger**: Scheduled (daily/weekly)
- **Scenario**: Full test suite
- **Purpose**: Performance regression detection
- **Failure Action**: Alert development team

## 📋 Test Results and Reporting

### Output Files
- `*_results.json`: K6 detailed test results
- `*_summary.txt`: Human-readable test summary
- `*_metrics.txt`: Extracted key metrics
- `test_report.md`: Comprehensive test report

### Key Metrics Extraction
The test runner automatically extracts and reports:
- HTTP request statistics (duration, failure rate, throughput)
- SLO compliance metrics (availability, latency, error rates)
- User journey success rates
- WebSocket connection statistics
- Performance trend analysis

### Alerting and Notifications
- Failed tests trigger CI/CD pipeline failures
- Performance regressions are automatically detected
- Results are uploaded as build artifacts
- Slack/email notifications for critical failures

## 🔧 Configuration and Customization

### Environment Variables
- `SCENARIO`: Test scenario (smoke, load, stress, spike, soak)
- `TARGET_ENV`: Target environment (development, staging, production)
- `BASE_URL`: API base URL override
- `FRONTEND_URL`: Frontend URL override

### Test Data Management
- Test users are pre-configured for each environment
- Random data generation for realistic testing
- Configurable message templates and search queries
- Location-based test scenarios

### Custom Test Development
Use the shared configuration and utilities:

```javascript
import config, { TEST_UTILS } from './k6-config.js';

export default function() {
  const envConfig = TEST_UTILS.getEnvironmentConfig('production');
  const authToken = authenticateUser(TEST_UTILS.randomUser());
  // Your test logic here
}
```

## 🛠 Troubleshooting

### Common Issues

#### Connection Refused Errors
- **Cause**: Service not running or unreachable
- **Solution**: Verify service health, check URL configuration
- **Command**: `curl -f $BASE_URL/health`

#### Authentication Failures  
- **Cause**: Invalid test user credentials
- **Solution**: Verify test users exist in target environment
- **Command**: Check user database or create test users

#### High Error Rates
- **Cause**: Service overload or resource constraints
- **Solution**: Review service logs, check resource utilization
- **Action**: Scale services or adjust test scenario

#### WebSocket Connection Issues
- **Cause**: Load balancer configuration or WebSocket proxy issues
- **Solution**: Check WebSocket endpoint configuration
- **Test**: `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" $WS_URL`

### Performance Tuning

#### Test Optimization
- Adjust scenario stages for your infrastructure
- Use appropriate virtual user counts
- Configure realistic think times and delays
- Balance test coverage with execution time

#### Result Analysis
- Focus on P95/P99 latencies rather than averages
- Monitor error rates and failure patterns
- Track performance trends over time
- Correlate load test results with system metrics

## 📚 Further Reading

- [K6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/running-large-tests/)
- [SLO Design Principles](https://sre.google/sre-book/service-level-objectives/)
- [Performance Testing Strategy](https://k6.io/docs/testing-guides/test-types/)

---

**Note**: This load testing suite is designed to validate the production readiness of the Link application. Regular execution helps ensure performance SLOs are met and regressions are caught early in the development cycle.