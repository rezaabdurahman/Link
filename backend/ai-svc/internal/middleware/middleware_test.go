package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

func TestNewRateLimiter(t *testing.T) {
	requestsPerMinute := 5
	burst := 10

	rl := NewRateLimiter(requestsPerMinute, burst)

	if rl == nil {
		t.Fatal("Expected rate limiter to be created, got nil")
	}

	if rl.burst != burst {
		t.Errorf("Expected burst to be %d, got %d", burst, rl.burst)
	}

	expectedRate := float64(requestsPerMinute) / 60
	if float64(rl.rate) != expectedRate {
		t.Errorf("Expected rate to be %f, got %f", expectedRate, float64(rl.rate))
	}

	if rl.limiters == nil {
		t.Error("Expected limiters map to be initialized")
	}
}

func TestRateLimiter_GetLimiter(t *testing.T) {
	rl := NewRateLimiter(5, 10)
	userID := uuid.New().String()

	// Get limiter for first time
	limiter1 := rl.GetLimiter(userID)
	if limiter1 == nil {
		t.Fatal("Expected limiter to be created")
	}

	// Get same limiter again
	limiter2 := rl.GetLimiter(userID)
	if limiter1 != limiter2 {
		t.Error("Expected same limiter instance for same user")
	}

	// Get limiter for different user
	differentUserID := uuid.New().String()
	limiter3 := rl.GetLimiter(differentUserID)
	if limiter1 == limiter3 {
		t.Error("Expected different limiter for different user")
	}
}

func TestJWTAuth_Success(t *testing.T) {
	logger := zerolog.New(nil)
	jwtSecret := "test-secret-key-for-testing"
	userID := uuid.New()

	// Create a valid JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &JWTClaims{
		UserID: userID,
		Email:  "test@example.com",
		Name:   "Test User",
		Role:   "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		t.Fatalf("Failed to create test JWT: %v", err)
	}

	// Create test request with JWT
	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+tokenString)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Create test handler that checks context
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if user info was added to context
		ctxUserID, err := GetUserIDFromContext(r.Context())
		if err != nil {
			t.Errorf("Expected user ID in context: %v", err)
		}
		if ctxUserID != userID {
			t.Errorf("Expected user ID %s, got %s", userID, ctxUserID)
		}

		email, err := GetUserEmailFromContext(r.Context())
		if err != nil {
			t.Errorf("Expected email in context: %v", err)
		}
		if email != "test@example.com" {
			t.Errorf("Expected email test@example.com, got %s", email)
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	// Apply JWT middleware
	middleware := JWTAuth(jwtSecret, &logger)
	handler := middleware(testHandler)

	// Execute request
	handler.ServeHTTP(rr, req)

	// Check response
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, status)
	}

	if rr.Body.String() != "success" {
		t.Errorf("Expected body 'success', got %s", rr.Body.String())
	}
}

func TestJWTAuth_MissingHeader(t *testing.T) {
	logger := zerolog.New(nil)
	jwtSecret := "test-secret"

	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}
	// No Authorization header

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called with missing auth header")
	})

	middleware := JWTAuth(jwtSecret, &logger)
	handler := middleware(testHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, status)
	}
}

func TestJWTAuth_InvalidFormat(t *testing.T) {
	logger := zerolog.New(nil)
	jwtSecret := "test-secret"

	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}
	req.Header.Set("Authorization", "Invalid token-format")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called with invalid auth format")
	})

	middleware := JWTAuth(jwtSecret, &logger)
	handler := middleware(testHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, status)
	}
}

func TestJWTAuth_InvalidToken(t *testing.T) {
	logger := zerolog.New(nil)
	jwtSecret := "test-secret"

	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer invalid.jwt.token")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called with invalid token")
	})

	middleware := JWTAuth(jwtSecret, &logger)
	handler := middleware(testHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, status)
	}
}

func TestJWTAuth_WrongSecret(t *testing.T) {
	logger := zerolog.New(nil)
	jwtSecret := "test-secret"
	wrongSecret := "wrong-secret"

	userID := uuid.New()

	// Create token with wrong secret
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &JWTClaims{
		UserID: userID,
		Email:  "test@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})

	tokenString, err := token.SignedString([]byte(wrongSecret))
	if err != nil {
		t.Fatalf("Failed to create test JWT: %v", err)
	}

	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+tokenString)

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called with wrong secret")
	})

	middleware := JWTAuth(jwtSecret, &logger)
	handler := middleware(testHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Expected status %d, got %d", http.StatusUnauthorized, status)
	}
}

func TestRateLimit_Success(t *testing.T) {
	logger := zerolog.New(nil)
	rl := NewRateLimiter(10, 5) // 10 requests per minute, burst 5
	userID := uuid.New()

	// Create request with user ID in context
	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}

	ctx := context.WithValue(req.Context(), "user_id", userID)
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	middleware := RateLimit(rl, &logger)
	handler := middleware(testHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, status)
	}

	// Check rate limit headers
	if rr.Header().Get("X-RateLimit-Limit") == "" {
		t.Error("Expected X-RateLimit-Limit header to be set")
	}

	if rr.Header().Get("X-RateLimit-Remaining") == "" {
		t.Error("Expected X-RateLimit-Remaining header to be set")
	}
}

func TestRateLimit_Exceeded(t *testing.T) {
	logger := zerolog.New(nil)
	rl := NewRateLimiter(1, 1) // Very restrictive: 1 request per minute, burst 1
	userID := uuid.New()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	})

	middleware := RateLimit(rl, &logger)
	handler := middleware(testHandler)

	// First request should succeed
	req1, _ := http.NewRequest("GET", "/test", nil)
	ctx1 := context.WithValue(req1.Context(), "user_id", userID)
	req1 = req1.WithContext(ctx1)
	rr1 := httptest.NewRecorder()

	handler.ServeHTTP(rr1, req1)

	if status := rr1.Code; status != http.StatusOK {
		t.Errorf("Expected first request to succeed, got status %d", status)
	}

	// Second request should be rate limited
	req2, _ := http.NewRequest("GET", "/test", nil)
	ctx2 := context.WithValue(req2.Context(), "user_id", userID)
	req2 = req2.WithContext(ctx2)
	rr2 := httptest.NewRecorder()

	handler.ServeHTTP(rr2, req2)

	if status := rr2.Code; status != http.StatusTooManyRequests {
		t.Errorf("Expected second request to be rate limited, got status %d", status)
	}

	// Check rate limit headers
	if rr2.Header().Get("X-RateLimit-Remaining") != "0" {
		t.Errorf("Expected remaining to be 0, got %s", rr2.Header().Get("X-RateLimit-Remaining"))
	}
}

func TestRateLimit_NoUserID(t *testing.T) {
	logger := zerolog.New(nil)
	rl := NewRateLimiter(10, 5)

	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}
	// No user ID in context

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called without user ID")
	})

	middleware := RateLimit(rl, &logger)
	handler := middleware(testHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, status)
	}
}

func TestRequestLogger(t *testing.T) {
	logger := zerolog.New(nil)
	userID := uuid.New()

	req, err := http.NewRequest("GET", "/test?param=value", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}
	req.Header.Set("User-Agent", "Test Agent")

	// Add user info to context
	ctx := context.WithValue(req.Context(), "user_id", userID)
	ctx = context.WithValue(ctx, "user_email", "test@example.com")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("test response"))
	})

	middleware := RequestLogger(&logger)
	handler := middleware(testHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, status)
	}

	if rr.Body.String() != "test response" {
		t.Errorf("Expected body 'test response', got %s", rr.Body.String())
	}
}

func TestPanicRecovery(t *testing.T) {
	logger := zerolog.New(nil)

	req, err := http.NewRequest("GET", "/test", nil)
	if err != nil {
		t.Fatalf("Failed to create test request: %v", err)
	}

	rr := httptest.NewRecorder()

	panicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	})

	middleware := PanicRecovery(&logger)
	handler := middleware(panicHandler)

	// Should not panic, should recover and return 500
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusInternalServerError {
		t.Errorf("Expected status %d after panic, got %d", http.StatusInternalServerError, status)
	}

	// Check that error response is JSON
	var errorResponse map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &errorResponse)
	if err != nil {
		t.Errorf("Expected JSON error response: %v", err)
	}

	if errorResponse["error"] != "INTERNAL_ERROR" {
		t.Errorf("Expected error code INTERNAL_ERROR, got %s", errorResponse["error"])
	}
}

func TestGetUserIDFromContext_Success(t *testing.T) {
	userID := uuid.New()
	ctx := context.WithValue(context.Background(), "user_id", userID)

	extractedID, err := GetUserIDFromContext(ctx)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if extractedID != userID {
		t.Errorf("Expected user ID %s, got %s", userID, extractedID)
	}
}

func TestGetUserIDFromContext_Missing(t *testing.T) {
	ctx := context.Background()

	_, err := GetUserIDFromContext(ctx)
	if err == nil {
		t.Error("Expected error when user ID is missing from context")
	}
}

func TestGetUserEmailFromContext_Success(t *testing.T) {
	email := "test@example.com"
	ctx := context.WithValue(context.Background(), "user_email", email)

	extractedEmail, err := GetUserEmailFromContext(ctx)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if extractedEmail != email {
		t.Errorf("Expected email %s, got %s", email, extractedEmail)
	}
}

func TestGetUserNameFromContext_Success(t *testing.T) {
	name := "Test User"
	ctx := context.WithValue(context.Background(), "user_name", name)

	extractedName, err := GetUserNameFromContext(ctx)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	if extractedName != name {
		t.Errorf("Expected name %s, got %s", name, extractedName)
	}
}

func TestGetClientIP(t *testing.T) {
	testCases := []struct {
		name           string
		headers        map[string]string
		remoteAddr     string
		expectedIP     string
	}{
		{
			name:       "X-Forwarded-For single IP",
			headers:    map[string]string{"X-Forwarded-For": "192.168.1.1"},
			remoteAddr: "10.0.0.1:8080",
			expectedIP: "192.168.1.1",
		},
		{
			name:       "X-Forwarded-For multiple IPs",
			headers:    map[string]string{"X-Forwarded-For": "192.168.1.1, 10.0.0.1, 172.16.0.1"},
			remoteAddr: "10.0.0.1:8080",
			expectedIP: "192.168.1.1",
		},
		{
			name:       "X-Real-IP",
			headers:    map[string]string{"X-Real-IP": "192.168.1.1"},
			remoteAddr: "10.0.0.1:8080",
			expectedIP: "192.168.1.1",
		},
		{
			name:       "RemoteAddr fallback",
			headers:    map[string]string{},
			remoteAddr: "192.168.1.1:8080",
			expectedIP: "192.168.1.1",
		},
		{
			name:       "RemoteAddr without port",
			headers:    map[string]string{},
			remoteAddr: "192.168.1.1",
			expectedIP: "192.168.1.1",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/test", nil)
			for key, value := range tc.headers {
				req.Header.Set(key, value)
			}
			req.RemoteAddr = tc.remoteAddr

			ip := getClientIP(req)
			if ip != tc.expectedIP {
				t.Errorf("Expected IP %s, got %s", tc.expectedIP, ip)
			}
		})
	}
}

func TestWriteErrorResponse(t *testing.T) {
	logger := zerolog.New(nil)
	rr := httptest.NewRecorder()

	details := map[string]string{
		"field": "value",
		"error": "details",
	}

	writeErrorResponse(rr, http.StatusBadRequest, "TEST_ERROR", "Test error message", details, &logger)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, status)
	}

	if contentType := rr.Header().Get("Content-Type"); contentType != "application/json" {
		t.Errorf("Expected Content-Type application/json, got %s", contentType)
	}

	var errorResponse map[string]interface{}
	err := json.Unmarshal(rr.Body.Bytes(), &errorResponse)
	if err != nil {
		t.Fatalf("Failed to unmarshal error response: %v", err)
	}

	if errorResponse["error"] != "TEST_ERROR" {
		t.Errorf("Expected error TEST_ERROR, got %s", errorResponse["error"])
	}

	if errorResponse["message"] != "Test error message" {
		t.Errorf("Expected message 'Test error message', got %s", errorResponse["message"])
	}

	// Check details
	if responseDetails, ok := errorResponse["details"].(map[string]interface{}); ok {
		if responseDetails["field"] != "value" {
			t.Errorf("Expected detail field to be 'value', got %s", responseDetails["field"])
		}
	} else {
		t.Error("Expected details to be present in error response")
	}
}

func BenchmarkRateLimiter_GetLimiter(b *testing.B) {
	rl := NewRateLimiter(100, 50)
	userIDs := make([]string, 100)
	for i := 0; i < 100; i++ {
		userIDs[i] = uuid.New().String()
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			rl.GetLimiter(userIDs[i%len(userIDs)])
			i++
		}
	})
}

func BenchmarkJWTAuth(b *testing.B) {
	logger := zerolog.New(nil)
	jwtSecret := "benchmark-secret-key"
	userID := uuid.New()

	// Create a valid JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &JWTClaims{
		UserID: userID,
		Email:  "bench@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})

	tokenString, _ := token.SignedString([]byte(jwtSecret))

	middleware := JWTAuth(jwtSecret, &logger)
	handler := middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req, _ := http.NewRequest("GET", "/test", nil)
			req.Header.Set("Authorization", "Bearer "+tokenString)
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)
		}
	})
}
