package cache

import (
	"context"
	"testing"
	"time"
)

// TestBasicCacheOperations tests basic cache functionality
func TestBasicCacheOperations(t *testing.T) {
	// Create a simple test config
	config := &CacheConfig{
		Provider:    ProviderRedis,
		Endpoints:   []string{"localhost:6379"},
		PoolSize:    1,
		DefaultTTL:  time.Minute,
		KeyPrefix:   "test",
	}

	// Skip if Redis is not available (for CI/testing environments)
	cache, err := NewRedisCache(config)
	if err != nil {
		t.Skipf("Redis not available, skipping test: %v", err)
	}
	defer cache.Close()

	ctx := context.Background()

	// Test Set and Get
	testKey := "test_key"
	testValue := []byte("test_value")

	err = cache.Set(ctx, testKey, testValue, time.Minute)
	if err != nil {
		t.Fatalf("Failed to set cache value: %v", err)
	}

	retrievedValue, err := cache.Get(ctx, testKey)
	if err != nil {
		t.Fatalf("Failed to get cache value: %v", err)
	}

	if string(retrievedValue) != string(testValue) {
		t.Errorf("Expected %s, got %s", testValue, retrievedValue)
	}

	// Test Exists
	exists, err := cache.Exists(ctx, testKey)
	if err != nil {
		t.Fatalf("Failed to check key existence: %v", err)
	}

	if !exists {
		t.Error("Key should exist")
	}

	// Test Delete
	err = cache.Delete(ctx, testKey)
	if err != nil {
		t.Fatalf("Failed to delete cache value: %v", err)
	}

	// Verify deletion
	_, err = cache.Get(ctx, testKey)
	if err == nil {
		t.Error("Expected cache miss after deletion")
	}

	// Check if it's a cache miss error
	if !IsCacheMiss(err) {
		t.Errorf("Expected cache miss error, got: %v", err)
	}
}

// TestCacheHelper tests the helper functionality
func TestCacheHelper(t *testing.T) {
	config := &CacheConfig{
		Provider:    ProviderRedis,
		Endpoints:   []string{"localhost:6379"},
		PoolSize:    1,
		DefaultTTL:  time.Minute,
		KeyPrefix:   "test_helper",
	}

	cache, err := NewRedisCache(config)
	if err != nil {
		t.Skipf("Redis not available, skipping test: %v", err)
	}
	defer cache.Close()

	helper := NewCacheHelper(cache, "test")
	ctx := context.Background()

	// Test struct serialization
	type TestStruct struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	original := TestStruct{Name: "test", Value: 42}

	err = helper.Set(ctx, "struct_key", original, time.Minute)
	if err != nil {
		t.Fatalf("Failed to set struct: %v", err)
	}

	var retrieved TestStruct
	err = helper.Get(ctx, "struct_key", &retrieved)
	if err != nil {
		t.Fatalf("Failed to get struct: %v", err)
	}

	if retrieved.Name != original.Name || retrieved.Value != original.Value {
		t.Errorf("Struct mismatch: expected %+v, got %+v", original, retrieved)
	}
}

// TestCacheFactory tests the factory functionality
func TestCacheFactory(t *testing.T) {
	config := CreateDefaultRedisConfig([]string{"localhost:6379"})
	config.KeyPrefix = "factory_test"

	cache, err := NewCache(config)
	if err != nil {
		t.Skipf("Redis not available, skipping test: %v", err)
	}
	defer cache.Close()

	// Test ping
	ctx := context.Background()
	err = cache.Ping(ctx)
	if err != nil {
		t.Fatalf("Cache ping failed: %v", err)
	}

	// Test basic operations through interface
	testKey := "factory_key"
	testValue := []byte("factory_value")

	err = cache.Set(ctx, testKey, testValue, time.Minute)
	if err != nil {
		t.Fatalf("Failed to set via interface: %v", err)
	}

	value, err := cache.Get(ctx, testKey)
	if err != nil {
		t.Fatalf("Failed to get via interface: %v", err)
	}

	if string(value) != string(testValue) {
		t.Errorf("Value mismatch: expected %s, got %s", testValue, value)
	}
}

// TestConfigValidation tests configuration validation
func TestConfigValidation(t *testing.T) {
	// Test valid config
	validConfig := &CacheConfig{
		Provider:    ProviderRedis,
		Endpoints:   []string{"localhost:6379"},
		PoolSize:    10,
		MinIdleConns: 5,
		DefaultTTL:  time.Hour,
	}

	err := ValidateConfig(validConfig)
	if err != nil {
		t.Errorf("Valid config should pass validation: %v", err)
	}

	// Test invalid config - no provider
	invalidConfig := &CacheConfig{}
	err = ValidateConfig(invalidConfig)
	if err == nil {
		t.Error("Config without provider should fail validation")
	}

	// Test invalid config - no endpoints
	invalidConfig2 := &CacheConfig{
		Provider: ProviderRedis,
	}
	err = ValidateConfig(invalidConfig2)
	if err == nil {
		t.Error("Config without endpoints should fail validation")
	}
}

// Benchmark basic operations
func BenchmarkCacheSet(b *testing.B) {
	config := CreateDefaultRedisConfig([]string{"localhost:6379"})
	cache, err := NewRedisCache(config)
	if err != nil {
		b.Skipf("Redis not available: %v", err)
	}
	defer cache.Close()

	ctx := context.Background()
	value := []byte("benchmark_value")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := cache.Set(ctx, "bench_key", value, time.Minute)
		if err != nil {
			b.Fatalf("Set failed: %v", err)
		}
	}
}

func BenchmarkCacheGet(b *testing.B) {
	config := CreateDefaultRedisConfig([]string{"localhost:6379"})
	cache, err := NewRedisCache(config)
	if err != nil {
		b.Skipf("Redis not available: %v", err)
	}
	defer cache.Close()

	ctx := context.Background()
	value := []byte("benchmark_value")

	// Set initial value
	err = cache.Set(ctx, "bench_key", value, time.Hour)
	if err != nil {
		b.Fatalf("Initial set failed: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := cache.Get(ctx, "bench_key")
		if err != nil {
			b.Fatalf("Get failed: %v", err)
		}
	}
}