package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
)

type Service struct {
	startTime time.Time
}

type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Uptime    string    `json:"uptime"`
	TLS       TLSInfo   `json:"tls"`
}

type TLSInfo struct {
	Enabled       bool   `json:"enabled"`
	ClientAuth    string `json:"client_auth"`
	MinVersion    string `json:"min_version"`
	CertSubject   string `json:"cert_subject,omitempty"`
	ClientSubject string `json:"client_subject,omitempty"`
}

type APIResponse struct {
	Message   string                 `json:"message"`
	Timestamp time.Time              `json:"timestamp"`
	Method    string                 `json:"method"`
	Path      string                 `json:"path"`
	Headers   map[string]interface{} `json:"headers"`
	TLS       TLSInfo                `json:"tls"`
	Body      interface{}            `json:"body,omitempty"`
}

func main() {
	log.Println("🚀 Starting mTLS Service...")

	service := &Service{
		startTime: time.Now(),
	}

	// Load server certificate and key
	serverCert, err := tls.LoadX509KeyPair("/certs/service.crt", "/certs/service.key")
	if err != nil {
		log.Fatalf("❌ Failed to load server certificate: %v", err)
	}

	// Load CA certificates to validate client certificates
	caCert, err := os.ReadFile("/certs/ca-bundle.crt")
	if err != nil {
		log.Fatalf("❌ Failed to read CA bundle: %v", err)
	}

	caCertPool := x509.NewCertPool()
	if !caCertPool.AppendCertsFromPEM(caCert) {
		log.Fatal("❌ Failed to parse CA certificate")
	}

	// Configure mTLS server
	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{serverCert},              // Server certificate
		ClientAuth:   tls.RequireAndVerifyClientCert,            // Require client certificate
		ClientCAs:    caCertPool,                                // CA certificates to validate clients
		MinVersion:   tls.VersionTLS12,                          // Enforce minimum TLS version
		CipherSuites: []uint16{                                  // Strong cipher suites
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		},
	}

	// Set up routes
	r := mux.NewRouter()
	r.HandleFunc("/health", service.healthHandler).Methods("GET")
	r.HandleFunc("/api/users", service.usersHandler).Methods("GET", "POST")
	r.HandleFunc("/api/users/{id}", service.userHandler).Methods("GET", "PUT", "DELETE")
	r.HandleFunc("/api/echo", service.echoHandler).Methods("GET", "POST", "PUT", "DELETE", "PATCH")
	r.HandleFunc("/api/{path:.*}", service.genericAPIHandler).Methods("GET", "POST", "PUT", "DELETE", "PATCH")

	// Configure HTTPS server with mTLS
	server := &http.Server{
		Addr:      ":8443",
		Handler:   r,
		TLSConfig: tlsConfig,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("🌐 Service listening on port 8443 (HTTPS)")
	log.Printf("🔐 mTLS enabled - requiring client certificates")
	log.Printf("🛡️ TLS 1.2+ enforced with strong cipher suites")

	// Start HTTPS server with mTLS
	if err := server.ListenAndServeTLS("", ""); err != nil {
		log.Fatalf("❌ Server failed to start: %v", err)
	}
}

func (s *Service) healthHandler(w http.ResponseWriter, r *http.Request) {
	tlsInfo := s.getTLSInfo(r)
	
	response := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now(),
		Uptime:    time.Since(s.startTime).String(),
		TLS:       tlsInfo,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
	
	log.Printf("✅ Health check from client: %s", tlsInfo.ClientSubject)
}

func (s *Service) usersHandler(w http.ResponseWriter, r *http.Request) {
	tlsInfo := s.getTLSInfo(r)
	
	var responseData interface{}
	
	switch r.Method {
	case "GET":
		responseData = []map[string]interface{}{
			{"id": 1, "name": "Alice", "email": "alice@example.com"},
			{"id": 2, "name": "Bob", "email": "bob@example.com"},
		}
	case "POST":
		body, _ := io.ReadAll(r.Body)
		var user map[string]interface{}
		json.Unmarshal(body, &user)
		user["id"] = 3
		responseData = user
	}

	response := APIResponse{
		Message:   "Users API endpoint",
		Timestamp: time.Now(),
		Method:    r.Method,
		Path:      r.URL.Path,
		Headers:   s.getRelevantHeaders(r),
		TLS:       tlsInfo,
		Body:      responseData,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
	
	log.Printf("📋 Users API call from client: %s", tlsInfo.ClientSubject)
}

func (s *Service) userHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["id"]
	tlsInfo := s.getTLSInfo(r)
	
	var responseData interface{}
	
	switch r.Method {
	case "GET":
		responseData = map[string]interface{}{
			"id": userID, "name": "User " + userID, "email": fmt.Sprintf("user%s@example.com", userID),
		}
	case "PUT":
		body, _ := io.ReadAll(r.Body)
		var user map[string]interface{}
		json.Unmarshal(body, &user)
		user["id"] = userID
		responseData = user
	case "DELETE":
		responseData = map[string]interface{}{"deleted": userID}
	}

	response := APIResponse{
		Message:   fmt.Sprintf("User %s API endpoint", userID),
		Timestamp: time.Now(),
		Method:    r.Method,
		Path:      r.URL.Path,
		Headers:   s.getRelevantHeaders(r),
		TLS:       tlsInfo,
		Body:      responseData,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
	
	log.Printf("👤 User API call for ID %s from client: %s", userID, tlsInfo.ClientSubject)
}

func (s *Service) echoHandler(w http.ResponseWriter, r *http.Request) {
	tlsInfo := s.getTLSInfo(r)
	
	body, _ := io.ReadAll(r.Body)
	var bodyData interface{}
	if len(body) > 0 {
		json.Unmarshal(body, &bodyData)
	}

	response := APIResponse{
		Message:   "Echo API endpoint - returns request details",
		Timestamp: time.Now(),
		Method:    r.Method,
		Path:      r.URL.Path,
		Headers:   s.getAllHeaders(r),
		TLS:       tlsInfo,
		Body:      bodyData,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
	
	log.Printf("🔄 Echo API call from client: %s", tlsInfo.ClientSubject)
}

func (s *Service) genericAPIHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	path := vars["path"]
	tlsInfo := s.getTLSInfo(r)

	response := APIResponse{
		Message:   fmt.Sprintf("Generic API endpoint for path: %s", path),
		Timestamp: time.Now(),
		Method:    r.Method,
		Path:      r.URL.Path,
		Headers:   s.getRelevantHeaders(r),
		TLS:       tlsInfo,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
	
	log.Printf("🌐 Generic API call to %s from client: %s", path, tlsInfo.ClientSubject)
}

func (s *Service) getTLSInfo(r *http.Request) TLSInfo {
	if r.TLS == nil {
		return TLSInfo{
			Enabled:    false,
			ClientAuth: "none",
		}
	}

	var clientSubject string
	var certSubject string
	
	if len(r.TLS.PeerCertificates) > 0 {
		clientSubject = r.TLS.PeerCertificates[0].Subject.String()
	}
	
	if len(r.TLS.PeerCertificates) > 0 {
		certSubject = r.TLS.PeerCertificates[0].Issuer.String()
	}

	var minVersion string
	switch r.TLS.Version {
	case tls.VersionTLS10:
		minVersion = "TLS 1.0"
	case tls.VersionTLS11:
		minVersion = "TLS 1.1"
	case tls.VersionTLS12:
		minVersion = "TLS 1.2"
	case tls.VersionTLS13:
		minVersion = "TLS 1.3"
	default:
		minVersion = "Unknown"
	}

	return TLSInfo{
		Enabled:       true,
		ClientAuth:    "RequireAndVerifyClientCert",
		MinVersion:    minVersion,
		CertSubject:   certSubject,
		ClientSubject: clientSubject,
	}
}

func (s *Service) getRelevantHeaders(r *http.Request) map[string]interface{} {
	relevantHeaders := []string{
		"X-Gateway", "X-Forwarded-For", "User-Agent", "Content-Type", "Authorization",
	}
	
	headers := make(map[string]interface{})
	for _, header := range relevantHeaders {
		if value := r.Header.Get(header); value != "" {
			headers[header] = value
		}
	}
	return headers
}

func (s *Service) getAllHeaders(r *http.Request) map[string]interface{} {
	headers := make(map[string]interface{})
	for name, values := range r.Header {
		if len(values) == 1 {
			headers[name] = values[0]
		} else {
			headers[name] = values
		}
	}
	return headers
}
