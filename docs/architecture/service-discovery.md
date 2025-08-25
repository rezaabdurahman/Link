# DESIGN-001: Service Discovery & Load Balancing for Multi-Instance Deployment

**Status:** Proposed  
**Date:** 2025-01-19  
**Author:** Architecture Team  
**Related ADR:** ADR-002 Distributed Database Strategy  

## Executive Summary

This document designs the service discovery and load balancing strategy for Link's multi-instance distributed architecture. The design enables the API Gateway to intelligently distribute requests across multiple instances of each service while providing resilience, health monitoring, and proper failover capabilities.

**Key Decision:** Leverage **Kubernetes native service discovery** with **enhanced API Gateway load balancing** to create a production-ready distributed communication layer.

---

## Current State Analysis

### Existing API Gateway Limitations

**Single Service Endpoint Pattern:**
```go
// Current services.go configuration
UserService: ServiceEndpoint{
    URL:       "http://user-svc:8080",  // Single endpoint
    HealthURL: "http://user-svc:8080/health",
    Timeout:   30,
}
```

**Problems for Multi-Instance:**
- ❌ **No Load Distribution:** All requests go to single service URL
- ❌ **No Failover:** If one instance fails, all requests fail
- ❌ **No Health Tracking:** Cannot detect and avoid unhealthy instances
- ❌ **No Circuit Breaking:** No protection against cascading failures
- ❌ **Manual Scaling:** Service URLs hardcoded, can't auto-discover instances

### Kubernetes Service Discovery Reality

**Current Kubernetes Setup:**
```yaml
# Helm configuration shows multi-instance intention
apiGateway:
  replicaCount: 3    # 3 API Gateway instances
userService:
  replicaCount: 2    # 2 User Service instances
```

**The Gap:** Kubernetes provides service discovery via DNS, but API Gateway doesn't utilize it for load balancing intelligence.

---

## Service Discovery Options Evaluation

### Option 1: Kubernetes Native (DNS-Based) ⭐ **RECOMMENDED**

**How it works:**
- Kubernetes automatically creates service DNS entries (e.g., `user-svc.default.svc.cluster.local`)
- Service DNS resolves to multiple pod IPs via round-robin
- API Gateway enhances this with application-level intelligence

**Pros:**
- ✅ **Zero Infrastructure:** Built into Kubernetes
- ✅ **Automatic Discovery:** Pods auto-registered/deregistered
- ✅ **Production Ready:** Used by most K8s applications
- ✅ **Cost Effective:** No additional components to manage
- ✅ **Resilience:** Kubernetes handles pod lifecycle

**Cons:**
- ⚠️ **Basic Load Balancing:** DNS round-robin only
- ⚠️ **No Circuit Breaking:** Need to implement at application level
- ⚠️ **Limited Metrics:** Need custom health and performance tracking

---

### Option 2: External Service Discovery (Consul/etcd)

**Pros:**
- ✅ Advanced service mesh features
- ✅ Rich API for service queries
- ✅ Built-in health checks and failover

**Cons:**
- ❌ **High Complexity:** Additional infrastructure to manage
- ❌ **Operational Overhead:** Consul cluster, backup, monitoring
- ❌ **Cost:** Extra resources required
- ❌ **Over-Engineering:** Kubernetes already provides core functionality

**Decision:** Reject - Unnecessary complexity for our use case

---

### Option 3: Service Mesh (Istio/Linkerd)

**Pros:**
- ✅ Advanced traffic management
- ✅ Built-in observability and security
- ✅ Automatic load balancing and circuit breaking

**Cons:**
- ❌ **Very High Complexity:** Steep learning curve
- ❌ **Performance Overhead:** Sidecar proxy latency
- ❌ **Operational Burden:** Complex troubleshooting
- ❌ **Overkill:** Can achieve goals with simpler approach

**Decision:** Defer - Consider for future when scale demands it

---

## Recommended Architecture

### Enhanced API Gateway with Kubernetes Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │ Load Balancer   │  │ Circuit Breaker │  │ Health Track │││
│  │ (Round Robin)   │  │ (Per Service)   │  │ (Instance)   │││
│  └─────────────────┘  └─────────────────┘  └──────────────┘││
└─────────────────────────────────────────────────────────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
   │ User-Svc        │ │ Chat-Svc        │ │ AI-Svc          │
   │ K8s Service DNS │ │ K8s Service DNS │ │ K8s Service DNS │
   │ ┌─────┐ ┌─────┐ │ │ ┌─────┐ ┌─────┐ │ │ ┌─────┐ ┌─────┐ │
   │ │Pod 1│ │Pod 2│ │ │ │Pod 1│ │Pod 2│ │ │ │Pod 1│ │Pod 2│ │
   │ └─────┘ └─────┘ │ │ └─────┘ └─────┘ │ │ └─────┘ └─────┘ │
   └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Core Design Principles

1. **Kubernetes Native:** Use built-in service discovery as foundation
2. **Application Intelligence:** Add smart load balancing in API Gateway  
3. **Resilience First:** Circuit breakers and health tracking for each service
4. **Observable:** Rich metrics and monitoring for troubleshooting
5. **Gradual Rollout:** Implement incrementally without breaking existing functionality

---

## Detailed Implementation Design

### 1. Enhanced Service Configuration

**New ServiceEndpoint Structure:**
```go
// Enhanced service endpoint supporting multiple instances
type ServiceEndpoint struct {
    Name        string            // Service identifier
    BaseURL     string            // Kubernetes service URL
    HealthPath  string            // Health check endpoint
    Timeout     time.Duration     // Per-request timeout
    Retries     int              // Retry attempts
    
    // Load balancing configuration
    LoadBalancer LoadBalancerConfig
    
    // Circuit breaker settings
    CircuitBreaker CircuitBreakerConfig
    
    // Instance tracking (populated at runtime)
    Instances []ServiceInstance  // Discovered instances
    
    // Metrics
    Metrics ServiceMetrics       // Request metrics
}

type LoadBalancerConfig struct {
    Strategy     string          // "round_robin", "weighted", "least_connections"
    HealthCheck  bool           // Enable health-based routing
    StickySessions bool          // Enable session affinity (if needed)
}

type CircuitBreakerConfig struct {
    Enabled           bool           // Enable circuit breaker
    FailureThreshold  int           // Failures before opening
    SuccessThreshold  int           // Successes to close
    Timeout          time.Duration  // Recovery timeout
}

type ServiceInstance struct {
    ID          string           // Pod name or identifier
    URL         string          // Instance-specific URL
    Healthy     bool            // Current health status
    LastCheck   time.Time       // Last health check
    Metrics     InstanceMetrics // Performance metrics
}
```

### 2. Service Discovery Implementation

**Kubernetes Service Resolution:**
```go
// ServiceDiscovery handles dynamic service instance discovery
type ServiceDiscovery struct {
    kubeClient kubernetes.Interface
    cache      map[string][]ServiceInstance
    mutex      sync.RWMutex
}

// DiscoverInstances queries Kubernetes API for service endpoints
func (sd *ServiceDiscovery) DiscoverInstances(serviceName string) ([]ServiceInstance, error) {
    // Get endpoints from Kubernetes API
    endpoints, err := sd.kubeClient.CoreV1().
        Endpoints(namespace).
        Get(context.Background(), serviceName, metav1.GetOptions{})
    
    if err != nil {
        return nil, fmt.Errorf("failed to get endpoints for %s: %v", serviceName, err)
    }
    
    var instances []ServiceInstance
    for _, subset := range endpoints.Subsets {
        for _, address := range subset.Addresses {
            instances = append(instances, ServiceInstance{
                ID:        address.TargetRef.Name, // Pod name
                URL:       fmt.Sprintf("http://%s:%d", address.IP, subset.Ports[0].Port),
                Healthy:   true, // Will be validated by health checks
                LastCheck: time.Now(),
            })
        }
    }
    
    return instances, nil
}
```

### 3. Load Balancing Strategies

**Round Robin with Health Awareness:**
```go
type LoadBalancer interface {
    SelectInstance(service *ServiceEndpoint, request *http.Request) (*ServiceInstance, error)
    UpdateInstanceHealth(serviceID, instanceID string, healthy bool)
}

type RoundRobinBalancer struct {
    counters map[string]*atomic.Uint64  // Per-service request counters
    mutex    sync.RWMutex
}

func (rb *RoundRobinBalancer) SelectInstance(service *ServiceEndpoint, req *http.Request) (*ServiceInstance, error) {
    // Filter healthy instances
    healthyInstances := rb.getHealthyInstances(service.Instances)
    if len(healthyInstances) == 0 {
        return nil, fmt.Errorf("no healthy instances available for service %s", service.Name)
    }
    
    // Round robin selection
    counter := rb.getCounter(service.Name)
    index := counter.Add(1) % uint64(len(healthyInstances))
    
    return &healthyInstances[index], nil
}
```

### 4. Circuit Breaker Implementation

**Per-Service Circuit Breaker:**
```go
type CircuitBreaker struct {
    state           CircuitState
    failures        int
    successes       int
    lastFailureTime time.Time
    config          CircuitBreakerConfig
    mutex           sync.RWMutex
}

type CircuitState int
const (
    CircuitClosed CircuitState = iota  // Normal operation
    CircuitOpen                        // Failing, reject requests
    CircuitHalfOpen                    // Testing recovery
)

func (cb *CircuitBreaker) Execute(fn func() error) error {
    cb.mutex.Lock()
    defer cb.mutex.Unlock()
    
    // Check if circuit should remain open
    if cb.state == CircuitOpen {
        if time.Since(cb.lastFailureTime) < cb.config.Timeout {
            return errors.New("circuit breaker is open")
        }
        cb.state = CircuitHalfOpen
    }
    
    // Execute the function
    err := fn()
    
    // Update circuit state based on result
    if err != nil {
        cb.failures++
        cb.lastFailureTime = time.Now()
        
        if cb.failures >= cb.config.FailureThreshold {
            cb.state = CircuitOpen
        }
    } else {
        cb.successes++
        
        if cb.state == CircuitHalfOpen && cb.successes >= cb.config.SuccessThreshold {
            cb.state = CircuitClosed
            cb.failures = 0
            cb.successes = 0
        }
    }
    
    return err
}
```

### 5. Health Monitoring System

**Continuous Health Checking:**
```go
type HealthMonitor struct {
    discovery      *ServiceDiscovery
    loadBalancer   LoadBalancer
    checkInterval  time.Duration
    checkTimeout   time.Duration
    client         *http.Client
}

func (hm *HealthMonitor) StartMonitoring(services map[string]*ServiceEndpoint) {
    ticker := time.NewTicker(hm.checkInterval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            for _, service := range services {
                hm.checkServiceHealth(service)
            }
        }
    }
}

func (hm *HealthMonitor) checkServiceHealth(service *ServiceEndpoint) {
    for _, instance := range service.Instances {
        go func(inst ServiceInstance) {
            healthy := hm.checkInstanceHealth(inst, service.HealthPath)
            hm.loadBalancer.UpdateInstanceHealth(service.Name, inst.ID, healthy)
        }(instance)
    }
}

func (hm *HealthMonitor) checkInstanceHealth(instance ServiceInstance, healthPath string) bool {
    ctx, cancel := context.WithTimeout(context.Background(), hm.checkTimeout)
    defer cancel()
    
    req, _ := http.NewRequestWithContext(ctx, "GET", instance.URL+healthPath, nil)
    resp, err := hm.client.Do(req)
    
    if err != nil {
        return false
    }
    defer resp.Body.Close()
    
    return resp.StatusCode == http.StatusOK
}
```

---

## Service Communication Patterns

### 1. Request Flow with Load Balancing

```
┌─────────────┐    ┌─────────────────────────────────────────┐
│   Client    │───▶│            API Gateway                  │
└─────────────┘    │ 1. Route determination                  │
                   │ 2. Service discovery                    │
                   │ 3. Instance selection (load balancer)  │
                   │ 4. Circuit breaker check               │
                   │ 5. Request execution                   │
                   │ 6. Response handling                   │
                   │ 7. Metrics update                      │
                   └─────────────────────────────────────────┘
                                      │
                   ┌─────────────────────────────────────────┐
                   │         Selected Service Instance        │
                   │ - Health check passed                   │
                   │ - Circuit breaker closed                │
                   │ - Round robin selected                  │
                   └─────────────────────────────────────────┘
```

### 2. Failure Handling Strategy

**Cascade of Resilience:**
1. **Instance Health Check:** Unhealthy instances removed from rotation
2. **Circuit Breaker:** Failing services temporarily bypassed  
3. **Retry Logic:** Failed requests retried on different instances
4. **Timeout Management:** Prevent resource exhaustion
5. **Graceful Degradation:** Return appropriate error responses

### 3. Service Instance Lifecycle

**Registration Flow:**
1. Pod starts and becomes ready
2. Kubernetes updates service endpoints
3. API Gateway discovers new instance via K8s API
4. Health monitor validates instance health
5. Load balancer adds instance to rotation

**Deregistration Flow:**
1. Pod becomes unhealthy or terminates
2. Health monitor detects failure
3. Load balancer removes from rotation
4. Kubernetes updates service endpoints
5. API Gateway removes from instance list

---

## Configuration Schema

### Service Configuration Update

**Enhanced docker-compose.yml:**
```yaml
api-gateway:
  environment:
    # Service Discovery
    KUBERNETES_NAMESPACE: default
    SERVICE_DISCOVERY_INTERVAL: 30s
    
    # Load Balancing
    LOAD_BALANCER_STRATEGY: round_robin
    HEALTH_CHECK_INTERVAL: 10s
    HEALTH_CHECK_TIMEOUT: 5s
    
    # Circuit Breaker (per service)
    USER_SVC_CIRCUIT_BREAKER_ENABLED: true
    USER_SVC_CIRCUIT_BREAKER_FAILURE_THRESHOLD: 5
    USER_SVC_CIRCUIT_BREAKER_TIMEOUT: 30s
    
    CHAT_SVC_CIRCUIT_BREAKER_ENABLED: true
    CHAT_SVC_CIRCUIT_BREAKER_FAILURE_THRESHOLD: 5
    CHAT_SVC_CIRCUIT_BREAKER_TIMEOUT: 30s
    
    # Retry Configuration
    DEFAULT_RETRY_ATTEMPTS: 3
    DEFAULT_RETRY_BACKOFF: 1s
```

**Enhanced Helm Values:**
```yaml
apiGateway:
  config:
    serviceDiscovery:
      enabled: true
      namespace: default
      refreshInterval: 30s
    
    loadBalancer:
      strategy: round_robin
      healthCheck:
        enabled: true
        interval: 10s
        timeout: 5s
    
    circuitBreaker:
      enabled: true
      defaultFailureThreshold: 5
      defaultTimeout: 30s
    
    retry:
      enabled: true
      defaultAttempts: 3
      defaultBackoff: 1s
```

---

## Monitoring & Observability

### 1. Metrics Collection

**Load Balancer Metrics:**
```
# Request distribution
gateway_requests_total{service="user-svc", instance="user-svc-pod-1", status="200"}
gateway_request_duration_seconds{service="user-svc", instance="user-svc-pod-1"}

# Instance health
gateway_instance_healthy{service="user-svc", instance="user-svc-pod-1"} 1
gateway_instance_last_check_seconds{service="user-svc", instance="user-svc-pod-1"}

# Circuit breaker state
gateway_circuit_breaker_state{service="user-svc"} 0  # 0=closed, 1=open, 2=half-open
gateway_circuit_breaker_failures{service="user-svc"}

# Load balancer performance  
gateway_load_balancer_instance_count{service="user-svc"}
gateway_service_discovery_refresh_duration_seconds
```

### 2. Health Check Dashboard

**Grafana Panels:**
- Service instance availability over time
- Request distribution across instances
- Circuit breaker state changes
- Service discovery refresh cycles
- Response time percentiles per instance

### 3. Alerting Rules

**Critical Alerts:**
```yaml
- alert: ServiceAllInstancesDown
  expr: sum(gateway_instance_healthy) by (service) == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "All instances down for {{ $labels.service }}"

- alert: ServiceCircuitBreakerOpen  
  expr: gateway_circuit_breaker_state > 0
  for: 30s
  labels:
    severity: warning
  annotations:
    summary: "Circuit breaker open for {{ $labels.service }}"

- alert: ServiceDiscoveryFailure
  expr: increase(gateway_service_discovery_errors_total[5m]) > 5
  labels:
    severity: warning
  annotations:
    summary: "Service discovery experiencing errors"
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

1. **Enhanced Service Configuration:**
   - Extend ServiceEndpoint structure
   - Add load balancer interface
   - Implement round-robin strategy

2. **Service Discovery Integration:**
   - Add Kubernetes client to API Gateway
   - Implement endpoint discovery
   - Cache service instances

3. **Basic Health Monitoring:**
   - Implement health check system
   - Update instance status
   - Remove unhealthy instances from rotation

### Phase 2: Resilience Patterns (Week 2)

1. **Circuit Breaker Implementation:**
   - Add per-service circuit breaker
   - Implement state machine
   - Add circuit breaker middleware

2. **Retry Logic:**
   - Add exponential backoff retry
   - Implement retry on different instances
   - Add retry metrics

3. **Enhanced Error Handling:**
   - Improve failure response handling
   - Add degraded service responses
   - Implement timeout management

### Phase 3: Advanced Features (Week 3)

1. **Advanced Load Balancing:**
   - Implement weighted round-robin
   - Add least-connections strategy
   - Add sticky sessions (if needed)

2. **Performance Optimization:**
   - Add connection pooling per instance
   - Implement request coalescing
   - Add caching layer

3. **Enhanced Monitoring:**
   - Add detailed metrics collection
   - Implement distributed tracing integration
   - Create observability dashboards

---

## Testing Strategy

### 1. Load Balancer Testing

**Test Scenarios:**
```bash
# Multiple instance deployment
kubectl scale deployment user-svc --replicas=3

# Verify request distribution
for i in {1..100}; do
  curl -H "X-Request-ID: $i" http://api-gateway/users/profile
done

# Analyze request distribution across instances
grep "X-Request-ID" /var/log/user-svc-*.log | sort
```

### 2. Failure Scenarios

**Instance Failure Testing:**
```bash
# Simulate pod failure
kubectl delete pod user-svc-pod-1

# Verify failover behavior
curl http://api-gateway/users/profile
# Should succeed using remaining instances

# Simulate service failure
kubectl scale deployment user-svc --replicas=0

# Verify circuit breaker activation
curl http://api-gateway/users/profile
# Should return circuit breaker open response
```

### 3. Performance Testing

**Multi-Instance Load Testing:**
```javascript
// K6 load test script
export default function() {
  const response = http.get('http://api-gateway/users/profile');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}

export let options = {
  stages: [
    { duration: '5m', target: 100 },   // Ramp up
    { duration: '10m', target: 100 },  // Stay at 100 users
    { duration: '5m', target: 0 },     // Ramp down
  ],
};
```

---

## Risk Assessment

### Low Risks ✅
- **Kubernetes Integration:** Well-established patterns and APIs
- **Load Balancing Logic:** Standard algorithms with proven implementations  
- **Health Monitoring:** Simple HTTP-based health checks

### Medium Risks ⚠️
- **Circuit Breaker Tuning:** Need to find optimal failure thresholds
- **Service Discovery Performance:** K8s API calls could add latency
- **Metrics Overhead:** Detailed tracking might impact performance

### High Risks ❌  
- **None identified** - This design builds on proven patterns with incremental complexity

---

## Success Metrics

### Technical Metrics

1. **Load Distribution:**
   - Request distribution variance \< 10% across healthy instances
   - Instance health detection time \< 10 seconds
   - Circuit breaker activation \< 30 seconds on failures

2. **Performance:**
   - Service discovery overhead \< 5ms per request
   - Load balancer selection \< 1ms
   - Overall request latency increase \< 10ms

### Operational Metrics

1. **Reliability:**
   - Zero-downtime deployments with rolling updates
   - Automatic failover on instance failures
   - Service availability \> 99.9% even with individual instance failures

2. **Observability:**
   - Complete visibility into instance health and performance
   - Proactive alerting on service degradation
   - Clear troubleshooting runbooks and dashboards

---

## Conclusion

This design provides a comprehensive, production-ready service discovery and load balancing solution that:

1. **Leverages Kubernetes Native Features** while adding intelligent application-level logic
2. **Provides Strong Resilience** through circuit breakers, health monitoring, and retry logic
3. **Maintains Operational Simplicity** without requiring additional infrastructure components
4. **Enables Horizontal Scaling** with automatic instance discovery and load distribution
5. **Includes Rich Observability** for monitoring and troubleshooting distributed systems

The implementation can be rolled out incrementally, starting with basic load balancing and gradually adding advanced resilience features as needed.

---

## Related Documents

- ADR-002: Distributed Database Strategy
- ADR-003: Event-Driven Architecture (TBD)
- RUNBOOK-001: Service Discovery Troubleshooting (TBD)

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-19  
**Next Review:** 2025-02-19
