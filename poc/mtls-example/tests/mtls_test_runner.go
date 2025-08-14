package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// TestResponse represents the expected JSON response structure
type TestResponse struct {
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	TLS       TLSInfo   `json:"tls"`
}

type TLSInfo struct {
	Enabled       bool   `json:"enabled"`
	ClientAuth    string `json:"client_auth"`
	MinVersion    string `json:"min_version"`
	CertSubject   string `json:"cert_subject,omitempty"`
	ClientSubject string `json:"client_subject,omitempty"`
}

// Configuration for the test
type Config struct {
	ServiceURL      string
	CertPath        string
	KeyPath         string
	CABundlePath    string
	ServerName      string
	Timeout         time.Duration
}

func getTestConfig() Config {
	certsDir := os.Getenv("CERTS_DIR")
	if certsDir == "" {
		certsDir = "./certs"
	}

	serviceURL := os.Getenv("SERVICE_URL")
	if serviceURL == "" {
		serviceURL = "https://localhost:8443"
	}

	serverName := os.Getenv("SERVER_NAME")
	if serverName == "" {
		serverName = "service"
	}

	return Config{
		ServiceURL:      serviceURL,
		CertPath:        certsDir + "/gateway.crt",
		KeyPath:         certsDir + "/gateway.key",
		CABundlePath:    certsDir + "/ca-bundle.crt",
		ServerName:      serverName,
		Timeout:         30 * time.Second,
	}
}

// setupMTLSClient creates an HTTP client configured for mTLS
func setupMTLSClient(config Config) (*http.Client, error) {
	// Load client certificate for authentication
	clientCert, err := tls.LoadX509KeyPair(config.CertPath, config.KeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load client certificate: %w", err)
	}

	// Load CA certificates to validate server certificates
	caCert, err := os.ReadFile(config.CABundlePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read CA bundle: %w", err)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		return nil, fmt.Errorf("failed to parse CA certificate")
	}

	// Configure TLS with mutual authentication
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{clientCert}, // Client certificate for authentication
		RootCAs:      caCertPool,                   // CA certificates to validate server
		ServerName:   config.ServerName,            // Expected server name
		MinVersion:   tls.VersionTLS12,             // Enforce minimum TLS version
	}

	// Create HTTP client with mTLS configuration
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
		Timeout: config.Timeout,
	}

	return client, nil
}

// TestMTLSHandshake performs a comprehensive mTLS handshake test
func testMTLSHandshake() error {
	config := getTestConfig()
	
	fmt.Printf("🔐 Testing mTLS handshake against: %s\n", config.ServiceURL)
	fmt.Printf("📋 Using certificates from: %s\n", config.CertPath)

	// Verify certificate files exist
	if _, err := os.Stat(config.CertPath); os.IsNotExist(err) {
		return fmt.Errorf("client certificate not found: %s", config.CertPath)
	}
	if _, err := os.Stat(config.KeyPath); os.IsNotExist(err) {
		return fmt.Errorf("client key not found: %s", config.KeyPath)
	}
	if _, err := os.Stat(config.CABundlePath); os.IsNotExist(err) {
		return fmt.Errorf("CA bundle not found: %s", config.CABundlePath)
	}

	// Setup mTLS client
	client, err := setupMTLSClient(config)
	if err != nil {
		return fmt.Errorf("failed to setup mTLS client: %v", err)
	}

	// Test health endpoint
	healthURL := config.ServiceURL + "/health"
	fmt.Printf("🏥 Testing health endpoint: %s\n", healthURL)
	
	resp, err := client.Get(healthURL)
	if err != nil {
		return fmt.Errorf("mTLS handshake failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	// Validate TLS connection properties
	if resp.TLS == nil {
		return fmt.Errorf("response does not contain TLS information")
	}

	// Verify TLS version
	if resp.TLS.Version < tls.VersionTLS12 {
		return fmt.Errorf("TLS version too low: %d (expected >= TLS 1.2)", resp.TLS.Version)
	}

	// Read and validate response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %v", err)
	}

	var healthResp TestResponse
	if err := json.Unmarshal(body, &healthResp); err != nil {
		return fmt.Errorf("failed to parse JSON response: %v", err)
	}

	// Validate response content
	if healthResp.Status != "healthy" {
		return fmt.Errorf("expected healthy status, got: %s", healthResp.Status)
	}

	if !healthResp.TLS.Enabled {
		return fmt.Errorf("TLS should be enabled in response")
	}

	if healthResp.TLS.ClientAuth != "RequireAndVerifyClientCert" {
		return fmt.Errorf("expected RequireAndVerifyClientCert, got: %s", healthResp.TLS.ClientAuth)
	}

	fmt.Printf("✅ mTLS handshake successful!\n")
	fmt.Printf("📊 TLS Version: %s\n", healthResp.TLS.MinVersion)
	fmt.Printf("🔑 Client Subject: %s\n", healthResp.TLS.ClientSubject)
	fmt.Printf("🏥 Service Status: %s\n", healthResp.Status)
	
	return nil
}

// testMTLSConnectionRejection tests that connections without client certs are rejected
func testMTLSConnectionRejection() error {
	config := getTestConfig()
	
	fmt.Printf("🔒 Testing connection rejection without client certificate\n")

	// Create client without client certificate
	caCert, err := os.ReadFile(config.CABundlePath)
	if err != nil {
		return fmt.Errorf("CA bundle not found: %s", config.CABundlePath)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		return fmt.Errorf("failed to parse CA certificate")
	}

	// Configure TLS without client certificate
	tlsConfig := &tls.Config{
		RootCAs:      caCertPool,        // CA certificates to validate server
		ServerName:   config.ServerName, // Expected server name
		MinVersion:   tls.VersionTLS12,  // Enforce minimum TLS version
		// No client certificates - this should fail
	}

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
		Timeout: 10 * time.Second,
	}

	// Attempt to connect - this should fail
	healthURL := config.ServiceURL + "/health"
	_, err = client.Get(healthURL)
	if err == nil {
		return fmt.Errorf("connection should have been rejected without client certificate")
	} else {
		fmt.Printf("✅ Connection properly rejected without client certificate: %v\n", err)
	}
	
	return nil
}

// testMTLSAPIEndpoints tests various API endpoints through mTLS
func testMTLSAPIEndpoints() error {
	config := getTestConfig()
	
	// Skip if certificates don't exist
	if _, err := os.Stat(config.CertPath); os.IsNotExist(err) {
		return fmt.Errorf("certificates not found")
	}

	client, err := setupMTLSClient(config)
	if err != nil {
		return fmt.Errorf("failed to setup mTLS client: %v", err)
	}

	testCases := []struct {
		endpoint string
		method   string
		desc     string
	}{
		{"/api/users", "GET", "Users list endpoint"},
		{"/api/echo", "GET", "Echo endpoint"},
		{"/api/test", "GET", "Generic API endpoint"},
	}

	for _, tc := range testCases {
		url := config.ServiceURL + tc.endpoint
		fmt.Printf("🔗 Testing %s %s\n", tc.method, url)

		req, err := http.NewRequest(tc.method, url, nil)
		if err != nil {
			return fmt.Errorf("failed to create request: %v", err)
		}

		resp, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		// Verify response is JSON
		contentType := resp.Header.Get("Content-Type")
		if contentType != "application/json" {
			return fmt.Errorf("expected JSON response, got: %s", contentType)
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read response: %v", err)
		}

		// Verify it's valid JSON
		var jsonResp map[string]interface{}
		if err := json.Unmarshal(body, &jsonResp); err != nil {
			return fmt.Errorf("invalid JSON response: %v", err)
		}

		fmt.Printf("✅ %s successful\n", tc.desc)
	}
	
	return nil
}

// testMTLSCertificateInfo validates certificate information
func testMTLSCertificateInfo() error {
	config := getTestConfig()
	
	fmt.Printf("📋 Validating certificate information\n")

	// Load and validate client certificate
	clientCert, err := tls.LoadX509KeyPair(config.CertPath, config.KeyPath)
	if err != nil {
		return fmt.Errorf("failed to load certificates: %v", err)
	}

	// Parse the certificate for validation
	cert, err := x509.ParseCertificate(clientCert.Certificate[0])
	if err != nil {
		return fmt.Errorf("failed to parse certificate: %v", err)
	}

	// Validate certificate is not expired
	now := time.Now()
	if now.Before(cert.NotBefore) {
		return fmt.Errorf("certificate is not yet valid (starts: %v)", cert.NotBefore)
	}
	if now.After(cert.NotAfter) {
		return fmt.Errorf("certificate is expired (ends: %v)", cert.NotAfter)
	}

	// Log certificate information
	fmt.Printf("📜 Certificate Subject: %s\n", cert.Subject)
	fmt.Printf("📜 Certificate Issuer: %s\n", cert.Issuer)
	fmt.Printf("⏰ Valid from: %v to %v\n", cert.NotBefore, cert.NotAfter)
	fmt.Printf("🔑 Key usage: %v\n", cert.KeyUsage)

	// Validate CA bundle
	caCert, err := os.ReadFile(config.CABundlePath)
	if err != nil {
		return fmt.Errorf("failed to read CA bundle: %v", err)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		return fmt.Errorf("failed to parse CA certificate")
	}

	// Verify certificate chain
	opts := x509.VerifyOptions{
		Roots: caCertPool,
	}
	
	_, err = cert.Verify(opts)
	if err != nil {
		return fmt.Errorf("certificate chain verification failed: %v", err)
	} else {
		fmt.Printf("✅ Certificate chain verification successful\n")
	}
	
	return nil
}

// Main function for running tests
func main() {
	// Allow running tests with 'test' argument
	if len(os.Args) > 1 && os.Args[1] == "test" {
		fmt.Println("🧪 Running mTLS Integration Tests")
		fmt.Println("==================================")
		
		config := getTestConfig()
		fmt.Printf("📋 Configuration:\n")
		fmt.Printf("  Service URL: %s\n", config.ServiceURL)
		fmt.Printf("  Certificate: %s\n", config.CertPath)
		fmt.Printf("  CA Bundle: %s\n", config.CABundlePath)
		fmt.Printf("  Server Name: %s\n", config.ServerName)
		fmt.Println()

		tests := []struct {
			name string
			fn   func() error
		}{
			{"mTLS Handshake", testMTLSHandshake},
			{"Connection Rejection", testMTLSConnectionRejection},
			{"API Endpoints", testMTLSAPIEndpoints},
			{"Certificate Info", testMTLSCertificateInfo},
		}

		passed := 0
		failed := 0

		for i, test := range tests {
			fmt.Printf("%d. Testing %s...\n", i+1, test.name)
			
			if err := test.fn(); err != nil {
				fmt.Printf("❌ %s failed: %v\n", test.name, err)
				failed++
			} else {
				fmt.Printf("✅ %s passed\n", test.name)
				passed++
			}
			fmt.Println()
		}
		
		fmt.Printf("📊 Test Results: %d passed, %d failed\n", passed, failed)
		
		if failed > 0 {
			fmt.Println("\n🎉 Some tests failed - check the output above for details")
			os.Exit(1)
		} else {
			fmt.Println("\n🎉 All tests passed!")
		}
	} else {
		fmt.Println("mTLS Integration Test Runner")
		fmt.Println("Usage:")
		fmt.Println("  go run mtls_test_runner.go test")
		fmt.Println()
		fmt.Println("Environment variables:")
		fmt.Println("  SERVICE_URL     - Service URL (default: https://localhost:8443)")
		fmt.Println("  CERTS_DIR       - Certificates directory (default: ./certs)")
		fmt.Println("  SERVER_NAME     - Expected server name (default: service)")
	}
}
