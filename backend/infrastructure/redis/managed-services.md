# Managed Redis Services Configuration

This guide covers configuration options for using managed Redis services instead of self-hosted Redis HA setup.

## 🎯 Overview

While our self-hosted Redis HA setup provides complete control, managed services offer:
- **Reduced operational overhead**
- **Built-in high availability**
- **Automated backups and monitoring**
- **Automatic scaling capabilities**
- **Professional support**

## ☁️ Supported Managed Services

### 1. AWS ElastiCache for Redis

#### Configuration
```yaml
# Environment variables for services
REDIS_PROVIDER=elasticache
REDIS_CLUSTER_ENDPOINT=your-cluster.xxxxx.cache.amazonaws.com:6379
REDIS_AUTH_TOKEN=your-auth-token
REDIS_SSL_ENABLED=true
REDIS_CLUSTER_MODE=enabled

# Connection pool settings
REDIS_POOL_SIZE=20
REDIS_MIN_IDLE_CONNS=5
REDIS_MAX_CONN_AGE=30m
```

#### Go Client Configuration
```go
import "api-gateway/internal/redis"

// ElastiCache configuration
config := &redis.Config{
    Addr:     os.Getenv("REDIS_CLUSTER_ENDPOINT"),
    Password: os.Getenv("REDIS_AUTH_TOKEN"),
    
    // SSL/TLS configuration
    TLSConfig: &tls.Config{
        ServerName: "your-cluster.xxxxx.cache.amazonaws.com",
    },
    
    // Connection pool settings
    PoolSize:      20,
    MinIdleConns:  5,
    MaxConnAge:    30 * time.Minute,
    PoolTimeout:   5 * time.Second,
    IdleTimeout:   5 * time.Minute,
    
    // Timeouts
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,
    DialTimeout:  5 * time.Second,
    
    // Retry settings
    MaxRetries:      3,
    MinRetryBackoff: 8 * time.Millisecond,
    MaxRetryBackoff: 512 * time.Millisecond,
}

client, err := redis.NewClient(config)
```

#### Terraform Configuration
```hcl
# ElastiCache Redis cluster
resource "aws_elasticache_subnet_group" "redis" {
  name       = "redis-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7"
  name   = "redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id         = "link-redis"
  description                  = "Redis cluster for Link application"
  
  node_type                    = "cache.r7g.large"
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  
  num_cache_clusters           = 2
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  
  subnet_group_name           = aws_elasticache_subnet_group.redis.name
  security_group_ids          = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                  = var.redis_auth_token
  
  # Backup configuration
  snapshot_retention_limit = 7
  snapshot_window         = "03:00-05:00"
  maintenance_window      = "sun:05:00-sun:07:00"
  
  # Notifications
  notification_topic_arn = aws_sns_topic.redis_notifications.arn
  
  tags = {
    Name        = "link-redis"
    Environment = var.environment
  }
}
```

### 2. Azure Cache for Redis

#### Configuration
```yaml
REDIS_PROVIDER=azure
REDIS_ENDPOINT=your-cache.redis.cache.windows.net:6380
REDIS_ACCESS_KEY=your-access-key
REDIS_SSL_ENABLED=true
```

#### Go Client Configuration
```go
config := &redis.Config{
    Addr:     os.Getenv("REDIS_ENDPOINT"),
    Password: os.Getenv("REDIS_ACCESS_KEY"),
    
    TLSConfig: &tls.Config{},
    
    PoolSize:      15,
    MinIdleConns:  3,
    MaxConnAge:    30 * time.Minute,
    
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,
    DialTimeout:  5 * time.Second,
}
```

#### Terraform Configuration
```hcl
resource "azurerm_redis_cache" "redis" {
  name                = "link-redis-cache"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  capacity            = 2
  family              = "C"
  sku_name            = "Standard"
  
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  
  redis_configuration {
    maxmemory_policy = "allkeys-lru"
  }
  
  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 2
  }
  
  tags = {
    Environment = var.environment
  }
}
```

### 3. Google Cloud Memorystore

#### Configuration
```yaml
REDIS_PROVIDER=memorystore
REDIS_ENDPOINT=10.x.x.x:6379
REDIS_AUTH_ENABLED=false  # Auth is handled by VPC
```

#### Terraform Configuration
```hcl
resource "google_redis_instance" "redis" {
  name           = "link-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 4
  
  location_id             = var.primary_zone
  alternative_location_id = var.secondary_zone
  
  authorized_network = google_compute_network.main.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  
  redis_version     = "REDIS_7_0"
  display_name      = "Link Redis Instance"
  
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }
  
  labels = {
    environment = var.environment
    application = "link"
  }
}
```

### 4. Redis Cloud (Redis Labs)

#### Configuration
```yaml
REDIS_PROVIDER=redis_cloud
REDIS_ENDPOINT=redis-xxx.redislabs.com:6379
REDIS_PASSWORD=your-redis-password
REDIS_SSL_ENABLED=true
```

#### Terraform Configuration
```hcl
terraform {
  required_providers {
    rediscloud = {
      source  = "RedisLabs/rediscloud"
      version = "~> 1.0"
    }
  }
}

resource "rediscloud_subscription" "redis" {
  name           = "link-subscription"
  payment_method = "credit-card"
  memory_storage = "ram"
  
  cloud_provider {
    provider         = "AWS"
    cloud_account_id = var.cloud_account_id
    region {
      region                 = "us-east-1"
      networking_deployment_cidr = "10.0.0.0/24"
      preferred_availability_zones = ["us-east-1a"]
    }
  }
}

resource "rediscloud_database" "redis" {
  subscription_id = rediscloud_subscription.redis.id
  name            = "link-database"
  protocol        = "redis"
  memory_limit_in_gb = 4
  
  replication       = true
  throughput_measurement_by = "operations-per-second"
  throughput_measurement_value = 10000
  
  modules {
    name = "RedisJSON"
  }
}
```

## 🔧 Migration Configuration

### Environment-Based Configuration
```bash
# .env.production
REDIS_PROVIDER=elasticache
REDIS_CLUSTER_ENDPOINT=your-cluster.cache.amazonaws.com:6379
REDIS_AUTH_TOKEN=your-token
REDIS_SSL_ENABLED=true

# .env.development  
REDIS_PROVIDER=local
REDIS_SENTINEL_ADDRS=redis-sentinel-1:26379,redis-sentinel-2:26379
REDIS_MASTER_NAME=mymaster
```

### Universal Redis Client
Update the Redis client to support multiple providers:

```go
// client/managed_redis_client.go
package redis

import (
    "crypto/tls"
    "os"
    "strconv"
    "strings"
    "time"
)

// ManagedRedisConfig creates configuration based on provider
func ManagedRedisConfig() (*Config, error) {
    provider := os.Getenv("REDIS_PROVIDER")
    
    switch provider {
    case "elasticache":
        return elastiCacheConfig(), nil
    case "azure":
        return azureRedisConfig(), nil
    case "memorystore":
        return memoryStoreConfig(), nil
    case "redis_cloud":
        return redisCloudConfig(), nil
    case "local", "":
        return localRedisConfig(), nil
    default:
        return nil, fmt.Errorf("unsupported Redis provider: %s", provider)
    }
}

func elastiCacheConfig() *Config {
    config := DefaultConfig()
    config.Addr = os.Getenv("REDIS_CLUSTER_ENDPOINT")
    config.Password = os.Getenv("REDIS_AUTH_TOKEN")
    
    if os.Getenv("REDIS_SSL_ENABLED") == "true" {
        config.TLSConfig = &tls.Config{
            ServerName: extractHostname(config.Addr),
        }
    }
    
    // ElastiCache specific optimizations
    config.PoolSize = 20
    config.MinIdleConns = 5
    config.MaxRetries = 5
    
    return config
}

func azureRedisConfig() *Config {
    config := DefaultConfig()
    config.Addr = os.Getenv("REDIS_ENDPOINT")
    config.Password = os.Getenv("REDIS_ACCESS_KEY")
    config.TLSConfig = &tls.Config{}
    
    // Azure specific optimizations
    config.PoolSize = 15
    config.ReadTimeout = 5 * time.Second
    config.WriteTimeout = 5 * time.Second
    
    return config
}

func memoryStoreConfig() *Config {
    config := DefaultConfig()
    config.Addr = os.Getenv("REDIS_ENDPOINT")
    // Memorystore typically doesn't use auth in VPC
    config.Password = ""
    
    return config
}

func redisCloudConfig() *Config {
    config := DefaultConfig()
    config.Addr = os.Getenv("REDIS_ENDPOINT")
    config.Password = os.Getenv("REDIS_PASSWORD")
    config.TLSConfig = &tls.Config{}
    
    return config
}

func localRedisConfig() *Config {
    // Use Sentinel configuration for local HA setup
    sentinelAddrs := strings.Split(os.Getenv("REDIS_SENTINEL_ADDRS"), ",")
    if len(sentinelAddrs) > 0 && sentinelAddrs[0] != "" {
        return SentinelConfig(sentinelAddrs, os.Getenv("REDIS_MASTER_NAME"))
    }
    
    // Fallback to single Redis instance
    return DefaultConfig()
}

func extractHostname(addr string) string {
    parts := strings.Split(addr, ":")
    if len(parts) > 0 {
        return parts[0]
    }
    return addr
}
```

## 🚀 Deployment Strategies

### 1. Blue-Green Migration
```bash
# Phase 1: Deploy with both configurations
REDIS_PROVIDER=local  # Current
REDIS_FALLBACK_PROVIDER=elasticache  # New

# Phase 2: Switch primary
REDIS_PROVIDER=elasticache  # New primary
REDIS_FALLBACK_PROVIDER=local  # Fallback

# Phase 3: Remove fallback
REDIS_PROVIDER=elasticache
```

### 2. Gradual Migration
```bash
# Migrate services one by one
# Service 1
USER_SVC_REDIS_PROVIDER=elasticache

# Service 2 (still on local)
CHAT_SVC_REDIS_PROVIDER=local

# Continue until all migrated
```

## 📊 Cost Comparison

| Provider | Small (2GB) | Medium (8GB) | Large (32GB) | HA Included |
|----------|-------------|--------------|--------------|-------------|
| AWS ElastiCache | ~$50/month | ~$200/month | ~$800/month | ✅ |
| Azure Cache | ~$45/month | ~$180/month | ~$720/month | ✅ |
| Google Memorystore | ~$40/month | ~$160/month | ~$640/month | ✅ |
| Redis Cloud | ~$35/month | ~$140/month | ~$560/month | ✅ |
| Self-hosted | ~$30/month* | ~$80/month* | ~$240/month* | ⚙️ Setup required |

*Infrastructure costs only, excluding operational overhead

## 🔍 Feature Comparison

| Feature | Self-hosted | ElastiCache | Azure Cache | Memorystore | Redis Cloud |
|---------|-------------|-------------|-------------|-------------|-------------|
| Custom Configuration | ✅ Full | 🔶 Limited | 🔶 Limited | 🔶 Limited | ✅ Full |
| Automatic Backups | ⚙️ Setup | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| Monitoring | ⚙️ Setup | ✅ CloudWatch | ✅ Azure Monitor | ✅ Cloud Monitoring | ✅ Built-in |
| Multi-AZ HA | ⚙️ Setup | ✅ Built-in | ✅ Built-in | ✅ Built-in | ✅ Built-in |
| Scaling | ⚙️ Manual | 🔶 Semi-auto | 🔶 Semi-auto | 🔶 Semi-auto | ✅ Auto |
| Redis Modules | ✅ All | 🔶 Limited | 🔶 Limited | ❌ None | ✅ All |

## 📋 Migration Checklist

### Pre-Migration
- [ ] Evaluate cost vs operational overhead
- [ ] Choose appropriate instance sizes
- [ ] Plan migration strategy (blue-green vs gradual)
- [ ] Set up monitoring and alerting
- [ ] Test failover procedures

### Migration
- [ ] Create managed Redis instances
- [ ] Configure security groups/VPC access
- [ ] Update service configurations
- [ ] Test connectivity from all services
- [ ] Migrate data (if needed)
- [ ] Update monitoring dashboards

### Post-Migration
- [ ] Monitor performance and costs
- [ ] Decommission old Redis infrastructure
- [ ] Update documentation and runbooks
- [ ] Train team on managed service operations

## 🛠️ Recommendation

**For Production**: Start with managed services (AWS ElastiCache, Azure Cache, or Google Memorystore) unless you need:
- Custom Redis modules not supported by managed services
- Very specific performance tuning
- Significant cost savings that justify operational overhead

**For Development**: Use the self-hosted Redis HA setup to maintain parity with production patterns and test failover scenarios.

The managed service approach provides the same high availability benefits with significantly less operational complexity.
