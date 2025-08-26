package loadbalancer

import (
	"fmt"
	"sync"
	"time"
)

type LoadBalancingStrategy int

const (
	RoundRobin LoadBalancingStrategy = iota
	Random
	LeastConnections
)

type Instance struct {
	ID        string
	URL       string
	HealthURL string
	Weight    int
	Timeout   time.Duration
	Healthy   bool
	mutex     sync.RWMutex
}

type LoadBalancer struct {
	strategy        LoadBalancingStrategy
	instances       []*Instance
	currentIndex    int
	maxFailures     int64
	timeout         time.Duration
	recoveryTimeout time.Duration
	mutex           sync.RWMutex
	healthChecker   *HealthChecker
}

type HealthChecker struct {
	loadBalancer *LoadBalancer
	stopChan     chan bool
}

func NewLoadBalancer(strategy LoadBalancingStrategy, maxFailures int64, timeout, recoveryTimeout time.Duration) *LoadBalancer {
	lb := &LoadBalancer{
		strategy:        strategy,
		instances:       make([]*Instance, 0),
		maxFailures:     maxFailures,
		timeout:         timeout,
		recoveryTimeout: recoveryTimeout,
	}
	
	lb.healthChecker = &HealthChecker{
		loadBalancer: lb,
		stopChan:     make(chan bool),
	}
	
	return lb
}

func (lb *LoadBalancer) AddInstance(id, url, healthURL string, weight int, timeout time.Duration) {
	lb.mutex.Lock()
	defer lb.mutex.Unlock()
	
	instance := &Instance{
		ID:        id,
		URL:       url,
		HealthURL: healthURL,
		Weight:    weight,
		Timeout:   timeout,
		Healthy:   true,
	}
	
	lb.instances = append(lb.instances, instance)
}

func (lb *LoadBalancer) GetNextInstance() (*Instance, error) {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	if len(lb.instances) == 0 {
		return nil, fmt.Errorf("no instances available")
	}
	
	// Simple round-robin implementation
	for attempts := 0; attempts < len(lb.instances); attempts++ {
		instance := lb.instances[lb.currentIndex]
		lb.currentIndex = (lb.currentIndex + 1) % len(lb.instances)
		
		instance.mutex.RLock()
		healthy := instance.Healthy
		instance.mutex.RUnlock()
		
		if healthy {
			return instance, nil
		}
	}
	
	return nil, fmt.Errorf("no healthy instances available")
}

func (lb *LoadBalancer) StartHealthChecking() {
	go lb.healthChecker.start()
}

func (lb *LoadBalancer) StopHealthChecking() {
	if lb.healthChecker != nil {
		lb.healthChecker.stopChan <- true
	}
}

func (lb *LoadBalancer) GetStats() map[string]interface{} {
	lb.mutex.RLock()
	defer lb.mutex.RUnlock()
	
	stats := map[string]interface{}{
		"total_instances":   len(lb.instances),
		"healthy_instances": 0,
		"strategy":          lb.strategy,
	}
	
	for _, instance := range lb.instances {
		instance.mutex.RLock()
		if instance.Healthy {
			stats["healthy_instances"] = stats["healthy_instances"].(int) + 1
		}
		instance.mutex.RUnlock()
	}
	
	return stats
}

func (hc *HealthChecker) start() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-hc.stopChan:
			return
		case <-ticker.C:
			hc.checkAllInstances()
		}
	}
}

func (hc *HealthChecker) checkAllInstances() {
	hc.loadBalancer.mutex.RLock()
	instances := make([]*Instance, len(hc.loadBalancer.instances))
	copy(instances, hc.loadBalancer.instances)
	hc.loadBalancer.mutex.RUnlock()
	
	for _, instance := range instances {
		hc.checkInstance(instance)
	}
}

func (hc *HealthChecker) checkInstance(instance *Instance) {
	// Simple health check - in real implementation would make HTTP request
	instance.mutex.Lock()
	defer instance.mutex.Unlock()
	
	// For now, assume all instances are healthy
	instance.Healthy = true
}