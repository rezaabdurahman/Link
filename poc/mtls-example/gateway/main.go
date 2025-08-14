package main

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

type Gateway struct {
	client    *http.Client
	serviceURL string
}

func main() {
	log.Println("🚀 Starting mTLS Gateway...")

	// Load certificates for client authentication
	clientCert, err := tls.LoadX509KeyPair("/certs/gateway.crt", "/certs/gateway.key")
	if err != nil {
		log.Fatalf("❌ Failed to load client certificate: %v", err)
	}

	// Load CA certificates to validate server certificates
	caCert, err := os.ReadFile("/certs/ca-bundle.crt")
	if err != nil {
		log.Fatalf("❌ Failed to read CA bundle: %v", err)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		log.Fatal("❌ Failed to parse CA certificate")
	}

	// Configure mTLS client
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{clientCert}, // Client certificate for authentication
		RootCAs:      caCertPool,                   // CA certificates to validate server
		ServerName:   "service",                    // Expected server name (from service certificate)
		MinVersion:   tls.VersionTLS12,             // Enforce minimum TLS version
	}

	// Create HTTP client with mTLS configuration
	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
		Timeout: 30 * time.Second,
	}

	gateway := &Gateway{
		client:     client,
		serviceURL: "https://service:8443", // Service running on port 8443 with mTLS
	}

	// Set up routes
	r := mux.NewRouter()
	r.HandleFunc("/health", gateway.healthHandler).Methods("GET")
	r.HandleFunc("/api/{path:.*}", gateway.proxyHandler).Methods("GET", "POST", "PUT", "DELETE", "PATCH")
	r.HandleFunc("/", gateway.homeHandler).Methods("GET")

	// Start server
	port := ":8080"
	log.Printf("🌐 Gateway listening on port %s", port)
	log.Printf("🔗 Proxying to service at %s", gateway.serviceURL)
	log.Printf("🔐 Using mTLS for service communication")
	
	if err := http.ListenAndServe(port, r); err != nil {
		log.Fatalf("❌ Server failed to start: %v", err)
	}
}

func (g *Gateway) healthHandler(w http.ResponseWriter, r *http.Request) {
	// Test connection to service
	resp, err := g.client.Get(g.serviceURL + "/health")
	if err != nil {
		log.Printf("⚠️  Service health check failed: %v", err)
		w.WriteHeader(http.StatusServiceUnavailable)
		fmt.Fprintf(w, `{"status": "unhealthy", "error": "%v", "timestamp": "%s"}`,
			err.Error(), time.Now().Format(time.RFC3339))
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status": "healthy", "service_status": %s, "timestamp": "%s"}`,
		string(body), time.Now().Format(time.RFC3339))
}

func (g *Gateway) proxyHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	path := vars["path"]
	
	// Construct the target URL
	targetURL := fmt.Sprintf("%s/api/%s", g.serviceURL, path)
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	log.Printf("🔄 Proxying %s %s -> %s", r.Method, r.URL.Path, targetURL)

	// Create new request
	req, err := http.NewRequest(r.Method, targetURL, r.Body)
	if err != nil {
		log.Printf("❌ Failed to create request: %v", err)
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Copy headers
	for key, values := range r.Header {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}

	// Add gateway identification header
	req.Header.Set("X-Gateway", "mtls-gateway")
	req.Header.Set("X-Forwarded-For", r.RemoteAddr)

	// Make the request
	resp, err := g.client.Do(req)
	if err != nil {
		log.Printf("❌ Request failed: %v", err)
		http.Error(w, fmt.Sprintf("Service unavailable: %v", err), http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Copy response
	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("❌ Failed to copy response: %v", err)
	}
}

func (g *Gateway) homeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	html := `
<!DOCTYPE html>
<html>
<head>
    <title>mTLS Gateway</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 20px; }
        .status { padding: 15px; border-radius: 5px; margin: 10px 0; }
        .success { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .info { background-color: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
        .endpoint { background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace; margin: 5px 0; }
        .cert-info { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 mTLS Gateway</h1>
            <p>Secure API Gateway with Mutual TLS Authentication</p>
        </div>
        
        <div class="status success">
            <strong>✅ Gateway Status:</strong> Running<br>
            <strong>🔗 Service URL:</strong> ` + g.serviceURL + `<br>
            <strong>🛡️ Security:</strong> mTLS Enabled
        </div>
        
        <div class="status info">
            <h3>Available Endpoints:</h3>
            <div class="endpoint">GET /health - Health check (gateway + service)</div>
            <div class="endpoint">GET|POST|PUT|DELETE /api/* - Proxy to service with mTLS</div>
            <div class="endpoint">GET / - This page</div>
        </div>
        
        <div class="cert-info">
            <h3>Certificate Information:</h3>
            <p><strong>Client Certificate:</strong> /certs/gateway.crt</p>
            <p><strong>CA Bundle:</strong> /certs/ca-bundle.crt</p>
            <p><strong>TLS Version:</strong> TLS 1.2+ required</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666;">
            <p>🚨 This is a development setup with self-signed certificates</p>
            <p>Timestamp: ` + time.Now().Format(time.RFC3339) + `</p>
        </div>
    </div>
</body>
</html>`
	fmt.Fprint(w, html)
}
