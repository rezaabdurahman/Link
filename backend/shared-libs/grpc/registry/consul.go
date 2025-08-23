package registry

import (
	"fmt"
	"strconv"
	"time"

	"github.com/hashicorp/consul/api"
)

// ServiceRegistry provides service discovery functionality
type ServiceRegistry struct {
	client     *api.Client
	services   map[string]*ServiceRegistration
	healthFunc func() bool
}

// ServiceRegistration holds service registration information
type ServiceRegistration struct {
	ID      string
	Name    string
	Address string
	Port    int
	Tags    []string
	TTL     time.Duration
}

// NewServiceRegistry creates a new service registry client
func NewServiceRegistry(consulEndpoint string) *ServiceRegistry {
	config := api.DefaultConfig()
	if consulEndpoint != "" {
		config.Address = consulEndpoint
	}

	client, err := api.NewClient(config)
	if err != nil {
		// Fallback to in-memory registry if Consul is not available
		return &ServiceRegistry{
			services: make(map[string]*ServiceRegistration),
		}
	}

	return &ServiceRegistry{
		client:   client,
		services: make(map[string]*ServiceRegistration),
		healthFunc: func() bool { return true }, // Default health check
	}
}

// Register registers a service with the registry
func (r *ServiceRegistry) Register(serviceName string, port int) error {
	if r.client == nil {
		// In-memory registration for fallback
		return r.registerInMemory(serviceName, port)
	}

	// Register with Consul
	return r.registerWithConsul(serviceName, port)
}

// Deregister removes a service from the registry
func (r *ServiceRegistry) Deregister(serviceName string) error {
	if r.client == nil {
		// In-memory deregistration
		delete(r.services, serviceName)
		return nil
	}

	// Deregister from Consul
	registration, exists := r.services[serviceName]
	if !exists {
		return fmt.Errorf("service %s not found in local registry", serviceName)
	}

	agent := r.client.Agent()
	err := agent.ServiceDeregister(registration.ID)
	if err != nil {
		return fmt.Errorf("failed to deregister service %s: %w", serviceName, err)
	}

	delete(r.services, serviceName)
	return nil
}

// Discover finds a service endpoint
func (r *ServiceRegistry) Discover(serviceName string) (string, error) {
	if r.client == nil {
		// In-memory discovery
		return r.discoverInMemory(serviceName)
	}

	// Discover from Consul
	return r.discoverFromConsul(serviceName)
}

// DiscoverAll finds all instances of a service
func (r *ServiceRegistry) DiscoverAll(serviceName string) ([]string, error) {
	if r.client == nil {
		// In-memory discovery
		endpoints, err := r.discoverInMemory(serviceName)
		if err != nil {
			return nil, err
		}
		return []string{endpoints}, nil
	}

	// Discover all from Consul
	return r.discoverAllFromConsul(serviceName)
}

// SetHealthFunc sets a custom health check function
func (r *ServiceRegistry) SetHealthFunc(healthFunc func() bool) {
	r.healthFunc = healthFunc
}

// registerInMemory registers service in memory (fallback)
func (r *ServiceRegistry) registerInMemory(serviceName string, port int) error {
	registration := &ServiceRegistration{
		ID:      fmt.Sprintf("%s-%d", serviceName, port),
		Name:    serviceName,
		Address: "localhost",
		Port:    port,
		Tags:    []string{"grpc", "api"},
		TTL:     30 * time.Second,
	}

	r.services[serviceName] = registration
	return nil
}

// discoverInMemory discovers service from memory (fallback)
func (r *ServiceRegistry) discoverInMemory(serviceName string) (string, error) {
	registration, exists := r.services[serviceName]
	if !exists {
		return "", fmt.Errorf("service %s not found", serviceName)
	}

	return fmt.Sprintf("%s:%d", registration.Address, registration.Port), nil
}

// registerWithConsul registers service with Consul
func (r *ServiceRegistry) registerWithConsul(serviceName string, port int) error {
	serviceID := fmt.Sprintf("%s-%d", serviceName, port)
	
	registration := &api.AgentServiceRegistration{
		ID:      serviceID,
		Name:    serviceName,
		Port:    port,
		Address: "localhost", // TODO: Get actual IP address
		Tags:    []string{"grpc", "api"},
		Check: &api.AgentServiceCheck{
			GRPC:                           fmt.Sprintf("localhost:%d", port),
			Interval:                       "10s",
			Timeout:                        "3s",
			DeregisterCriticalServiceAfter: "30s",
		},
	}

	agent := r.client.Agent()
	err := agent.ServiceRegister(registration)
	if err != nil {
		return fmt.Errorf("failed to register service %s: %w", serviceName, err)
	}

	// Store registration info locally
	r.services[serviceName] = &ServiceRegistration{
		ID:      serviceID,
		Name:    serviceName,
		Address: "localhost",
		Port:    port,
		Tags:    []string{"grpc", "api"},
		TTL:     30 * time.Second,
	}

	return nil
}

// discoverFromConsul discovers service from Consul
func (r *ServiceRegistry) discoverFromConsul(serviceName string) (string, error) {
	catalog := r.client.Catalog()
	services, _, err := catalog.Service(serviceName, "grpc", nil)
	if err != nil {
		return "", fmt.Errorf("failed to discover service %s: %w", serviceName, err)
	}

	if len(services) == 0 {
		return "", fmt.Errorf("no healthy instances of service %s found", serviceName)
	}

	// Return the first healthy instance
	service := services[0]
	return fmt.Sprintf("%s:%d", service.ServiceAddress, service.ServicePort), nil
}

// discoverAllFromConsul discovers all instances of a service from Consul
func (r *ServiceRegistry) discoverAllFromConsul(serviceName string) ([]string, error) {
	catalog := r.client.Catalog()
	services, _, err := catalog.Service(serviceName, "grpc", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to discover service %s: %w", serviceName, err)
	}

	if len(services) == 0 {
		return nil, fmt.Errorf("no instances of service %s found", serviceName)
	}

	endpoints := make([]string, len(services))
	for i, service := range services {
		endpoints[i] = fmt.Sprintf("%s:%d", service.ServiceAddress, service.ServicePort)
	}

	return endpoints, nil
}

// HealthCheck performs a health check and updates the service status
func (r *ServiceRegistry) HealthCheck(serviceName string) error {
	if r.client == nil {
		// For in-memory registry, just check if service exists
		if _, exists := r.services[serviceName]; !exists {
			return fmt.Errorf("service %s not found", serviceName)
		}
		return nil
	}

	// For Consul, the health check is handled automatically via the agent
	// We can optionally perform additional checks here
	if r.healthFunc != nil && !r.healthFunc() {
		return fmt.Errorf("service %s health check failed", serviceName)
	}

	return nil
}

// GetServices returns all registered services
func (r *ServiceRegistry) GetServices() (map[string]*ServiceRegistration, error) {
	if r.client == nil {
		// Return in-memory services
		return r.services, nil
	}

	// Get services from Consul
	catalog := r.client.Catalog()
	services, _, err := catalog.Services(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}

	result := make(map[string]*ServiceRegistration)
	for serviceName := range services {
		// Get service details
		serviceInstances, _, err := catalog.Service(serviceName, "", nil)
		if err != nil {
			continue
		}

		if len(serviceInstances) > 0 {
			instance := serviceInstances[0]
			result[serviceName] = &ServiceRegistration{
				ID:      instance.ServiceID,
				Name:    serviceName,
				Address: instance.ServiceAddress,
				Port:    instance.ServicePort,
				Tags:    instance.ServiceTags,
			}
		}
	}

	return result, nil
}

// Watch watches for service changes (simplified implementation)
func (r *ServiceRegistry) Watch(serviceName string, callback func([]string)) error {
	if r.client == nil {
		// For in-memory registry, just call callback once with current endpoint
		endpoint, err := r.discoverInMemory(serviceName)
		if err != nil {
			return err
		}
		callback([]string{endpoint})
		return nil
	}

	// For Consul, we would implement proper watching here
	// This is a simplified version that polls every 30 seconds
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				endpoints, err := r.discoverAllFromConsul(serviceName)
				if err == nil {
					callback(endpoints)
				}
			}
		}
	}()

	return nil
}

// Close closes the registry client
func (r *ServiceRegistry) Close() error {
	// Clean up any resources if needed
	return nil
}

// Helper functions

// GetLocalIP gets the local IP address (simplified)
func GetLocalIP() string {
	// TODO: Implement proper local IP detection
	return "localhost"
}

// GenerateServiceID generates a unique service ID
func GenerateServiceID(serviceName string, port int) string {
	hostname := GetLocalIP()
	return fmt.Sprintf("%s-%s-%s", serviceName, hostname, strconv.Itoa(port))
}