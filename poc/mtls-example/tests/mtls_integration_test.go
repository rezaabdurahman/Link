package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
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
func TestMTLSHandshake(t *testing.T) {
	config := getTestConfig()
	
	t.Logf("🔐 Testing mTLS handshake against: %s", config.ServiceURL)
	t.Logf("📋 Using certificates from: %s", config.CertPath)

	// Verify certificate files exist
	if _, err := os.Stat(config.CertPath); os.IsNotExist(err) {
		t.Skipf("⏭️ Skipping test - client certificate not found: %s", config.CertPath)
	}
	if _, err := os.Stat(config.KeyPath); os.IsNotExist(err) {
		t.Skipf("⏭️ Skipping test - client key not found: %s", config.KeyPath)
	}
	if _, err := os.Stat(config.CABundlePath); os.IsNotExist(err) {
		t.Skipf("⏭️ Skipping test - CA bundle not found: %s", config.CABundlePath)
	}

	// Setup mTLS client
	client, err := setupMTLSClient(config)
	if err != nil {
		t.Fatalf("❌ Failed to setup mTLS client: %v", err)
	}

	// Test health endpoint
	healthURL := config.ServiceURL + "/health"
	t.Logf("🏥 Testing health endpoint: %s", healthURL)
	
	resp, err := client.Get(healthURL)
	if err != nil {
		t.Fatalf("❌ mTLS handshake failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("❌ Expected status 200, got %d", resp.StatusCode)
	}

	// Validate TLS connection properties
	if resp.TLS == nil {
		t.Fatal("❌ Response does not contain TLS information")
	}

	// Verify TLS version
	if resp.TLS.Version < tls.VersionTLS12 {
		t.Errorf("❌ TLS version too low: %d (expected >= TLS 1.2)", resp.TLS.Version)
	}

	// Verify peer certificates (client cert was presented)
	if len(resp.TLS.PeerCertificates) == 0 {
		t.Error("❌ No peer certificates found - mTLS may not be working properly")
	}

	// Read and validate response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("❌ Failed to read response body: %v", err)
	}

	var healthResp TestResponse
	if err := json.Unmarshal(body, &healthResp); err != nil {
		t.Fatalf("❌ Failed to parse JSON response: %v", err)
	}

	// Validate response content
	if healthResp.Status != "healthy" {
		t.Errorf("❌ Expected healthy status, got: %s", healthResp.Status)
	}

	if !healthResp.TLS.Enabled {
		t.Error("❌ TLS should be enabled in response")
	}

	if healthResp.TLS.ClientAuth != "RequireAndVerifyClientCert" {
		t.Errorf("❌ Expected RequireAndVerifyClientCert, got: %s", healthResp.TLS.ClientAuth)
	}

	t.Logf("✅ mTLS handshake successful!")
	t.Logf("📊 TLS Version: %s", healthResp.TLS.MinVersion)
	t.Logf("🔑 Client Subject: %s", healthResp.TLS.ClientSubject)
	t.Logf("🏥 Service Status: %s", healthResp.Status)
}

// TestMTLSConnectionRejection tests that connections without client certs are rejected
func TestMTLSConnectionRejection(t *testing.T) {
	config := getTestConfig()
	
	t.Logf("🔒 Testing connection rejection without client certificate")

	// Create client without client certificate
	caCert, err := os.ReadFile(config.CABundlePath)
	if err != nil {
		t.Skipf("⏭️ Skipping test - CA bundle not found: %s", config.CABundlePath)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		t.Fatalf("❌ Failed to parse CA certificate")
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
		t.Error("❌ Connection should have been rejected without client certificate")
	} else {
		t.Logf("✅ Connection properly rejected without client certificate: %v", err)
	}
}

// TestMTLSAPIEndpoints tests various API endpoints through mTLS
func TestMTLSAPIEndpoints(t *testing.T) {
	config := getTestConfig()
	
	// Skip if certificates don't exist
	if _, err := os.Stat(config.CertPath); os.IsNotExist(err) {
		t.Skipf("⏭️ Skipping test - certificates not found")
	}

	client, err := setupMTLSClient(config)
	if err != nil {
		t.Fatalf("❌ Failed to setup mTLS client: %v", err)
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
		t.Run(tc.desc, func(t *testing.T) {
			url := config.ServiceURL + tc.endpoint
			t.Logf("🔗 Testing %s %s", tc.method, url)

			req, err := http.NewRequest(tc.method, url, nil)
			if err != nil {
				t.Fatalf("❌ Failed to create request: %v", err)
			}

			resp, err := client.Do(req)
			if err != nil {
				t.Fatalf("❌ Request failed: %v", err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				t.Errorf("❌ Expected status 200, got %d", resp.StatusCode)
			}

			// Verify response is JSON
			contentType := resp.Header.Get("Content-Type")
			if contentType != "application/json" {
				t.Errorf("❌ Expected JSON response, got: %s", contentType)
			}

			body, err := io.ReadAll(resp.Body)
			if err != nil {
				t.Fatalf("❌ Failed to read response: %v", err)
			}

			// Verify it's valid JSON
			var jsonResp map[string]interface{}
			if err := json.Unmarshal(body, &jsonResp); err != nil {
				t.Errorf("❌ Invalid JSON response: %v", err)
			}

			t.Logf("✅ %s successful", tc.desc)
		})
	}
}

// TestMTLSCertificateInfo validates certificate information
func TestMTLSCertificateInfo(t *testing.T) {
	config := getTestConfig()
	
	t.Log("📋 Validating certificate information")

	// Load and validate client certificate
	clientCert, err := tls.LoadX509KeyPair(config.CertPath, config.KeyPath)
	if err != nil {
		t.Skipf("⏭️ Skipping test - failed to load certificates: %v", err)
	}

	// Parse the certificate for validation
	cert, err := x509.ParseCertificate(clientCert.Certificate[0])
	if err != nil {
		t.Fatalf("❌ Failed to parse certificate: %v", err)
	}

	// Validate certificate is not expired
	now := time.Now()
	if now.Before(cert.NotBefore) {
		t.Errorf("❌ Certificate is not yet valid (starts: %v)", cert.NotBefore)
	}
	if now.After(cert.NotAfter) {
		t.Errorf("❌ Certificate is expired (ends: %v)", cert.NotAfter)
	}

	// Log certificate information
	t.Logf("📜 Certificate Subject: %s", cert.Subject)
	t.Logf("📜 Certificate Issuer: %s", cert.Issuer)
	t.Logf("⏰ Valid from: %v to %v", cert.NotBefore, cert.NotAfter)
	t.Logf("🔑 Key usage: %v", cert.KeyUsage)

	// Validate CA bundle
	caCert, err := os.ReadFile(config.CABundlePath)
	if err != nil {
		t.Fatalf("❌ Failed to read CA bundle: %v", err)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		t.Fatal("❌ Failed to parse CA certificate")
	}

	// Verify certificate chain
	opts := x509.VerifyOptions{
		Roots: caCertPool,
	}
	
	_, err = cert.Verify(opts)
	if err != nil {
		t.Errorf("❌ Certificate chain verification failed: %v", err)
	} else {
		t.Log("✅ Certificate chain verification successful")
	}
}

// Main function for running as standalone program
func main() {
	// Allow running as standalone program for manual testing
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

		// Simulate test execution
		t := &testing.T{}
		
		fmt.Println("1. Testing mTLS handshake...")
		TestMTLSHandshake(t)
		
		fmt.Println("\n2. Testing connection rejection...")
		TestMTLSConnectionRejection(t)
		
		fmt.Println("\n3. Testing API endpoints...")
		TestMTLSAPIEndpoints(t)
		
		fmt.Println("\n4. Testing certificate info...")
		TestMTLSCertificateInfo(t)
		
		fmt.Println("\n🎉 All tests completed!")
	} else {
		fmt.Println("mTLS Integration Test Suite")
		fmt.Println("Usage:")
		fmt.Println("  go test -v tests/mtls_integration_test.go")
		fmt.Println("  go run tests/mtls_integration_test.go test")
		fmt.Println()
		fmt.Println("Environment variables:")
		fmt.Println("  SERVICE_URL     - Service URL (default: https://localhost:8443)")
		fmt.Println("  CERTS_DIR       - Certificates directory (default: ./certs)")
		fmt.Println("  SERVER_NAME     - Expected server name (default: service)")
	}
}
