# Redis High Availability Setup

This directory contains a complete Redis High Availability setup using Redis Sentinel for automatic failover, master-slave replication, and connection pooling for distributed microservices.

## 🏗️ Architecture

### Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Sentinel 1    │    │   Sentinel 2    │    │   Sentinel 3    │
│   Port: 26379   │    │   Port: 26380   │    │   Port: 26381   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────┬───────────┼───────────┬───────────┘
                      │           │           │
              ┌───────▼────┐  ┌───▼────┐  ┌──▼─────┐
              │   Master   │  │ Slave1 │  │ Slave2 │
              │ Port: 6379 │  │ Port:  │  │ Port:  │
              │            │  │ 6380   │  │ 6381   │
              └────────────┘  └────────┘  └────────┘
                      │           ▲           ▲
                      └───────────┴───────────┘
                          Replication
```

### Components

#### Redis Master-Slave Replication
- **1 Master**: Handles all write operations
- **2 Slaves**: Handle read operations and provide redundancy
- **Asynchronous Replication**: Data is replicated from master to slaves
- **Automatic Promotion**: Slaves can be promoted to master during failover

#### Redis Sentinel
- **3 Sentinel Instances**: Monitor Redis instances and coordinate failover
- **Quorum = 2**: Minimum sentinels needed to agree on failover
- **Automatic Failover**: Promotes slave to master when master fails
- **Configuration Propagation**: Updates client configurations after failover

#### Monitoring & Management
- **Redis Exporter**: Prometheus metrics for monitoring
- **Redis Commander**: Web UI for Redis management
- **Health Checks**: Automated health monitoring for all instances

## 📁 Directory Structure

```
redis/
├── README.md                     # This file
├── docker-compose.redis-ha.yml   # Docker Compose for HA setup
├── redis-master.conf            # Master configuration
├── redis-slave.conf             # Slave configuration
├── sentinel.conf                # Sentinel configuration
├── client/                      # Redis client library
│   └── redis_client.go         # Go client with Sentinel support
├── k8s/                         # Kubernetes manifests
│   └── redis-ha.yaml           # Complete K8s deployment
└── scripts/                     # Testing and utilities
    └── test_redis_ha.sh         # Comprehensive HA tests
```

## 🚀 Quick Start

### Docker Compose Deployment

1. **Start Redis HA Stack**:
   ```bash
   cd backend/infrastructure/redis
   docker-compose -f docker-compose.redis-ha.yml up -d
   ```

2. **Verify Deployment**:
   ```bash
   # Check all services are running
   docker-compose -f docker-compose.redis-ha.yml ps
   
   # Run comprehensive tests
   ./scripts/test_redis_ha.sh
   ```

3. **Access Services**:
   - Redis Commander UI: http://localhost:8081 (admin/admin)
   - Redis Metrics: http://localhost:9121/metrics
   - Master: localhost:6379
   - Slaves: localhost:6380, localhost:6381
   - Sentinels: localhost:26379, localhost:26380, localhost:26381

### Kubernetes Deployment

1. **Deploy to Kubernetes**:
   ```bash
   kubectl apply -f k8s/redis-ha.yaml
   ```

2. **Check Status**:
   ```bash
   kubectl get pods -n redis-ha
   kubectl get services -n redis-ha
   ```

3. **Port Forward for Access**:
   ```bash
   # Redis Sentinel
   kubectl port-forward -n redis-ha svc/redis-sentinel-lb 26379:26379
   
   # Redis Master
   kubectl port-forward -n redis-ha svc/redis-master 6379:6379
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_MASTER_HOST` | Redis master hostname | redis-master |
| `REDIS_SENTINEL_HOSTS` | Sentinel hosts (comma-separated) | redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379 |
| `REDIS_MASTER_NAME` | Master name in Sentinel | mymaster |
| `REDIS_PASSWORD` | Redis password (if enabled) | (none) |
| `REDIS_DB` | Redis database number | 0 |

### Service Configuration

#### For Go Services
```go
import "your-project/backend/infrastructure/redis/client"

// Sentinel configuration
config := redis.SentinelConfig(
    []string{"redis-sentinel-1:26379", "redis-sentinel-2:26379", "redis-sentinel-3:26379"},
    "mymaster",
)

// Create client
redisClient, err := redis.NewClient(config)
if err != nil {
    log.Fatal("Failed to connect to Redis:", err)
}
defer redisClient.Close()

// Use client
err = redisClient.Set(context.Background(), "key", "value", time.Hour)
```

#### Environment Configuration for Services
```bash
# Add to service environment variables
REDIS_SENTINEL_ADDRS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379
REDIS_MASTER_NAME=mymaster
REDIS_PASSWORD=
REDIS_DB=0
REDIS_POOL_SIZE=10
REDIS_MIN_IDLE_CONNS=5
```

## 🧪 Testing

### Comprehensive Test Suite
```bash
# Run all tests
./scripts/test_redis_ha.sh
```

Tests include:
- **Connectivity Tests**: Verify all Redis and Sentinel instances
- **Replication Tests**: Ensure data replication works correctly
- **Failover Tests**: Test automatic failover functionality
- **Write During Failover**: Test service continuity during failover
- **Performance Tests**: Benchmark Redis performance
- **Monitoring Tests**: Verify metrics and monitoring

### Manual Testing

#### Test Basic Connectivity
```bash
# Test master
redis-cli -p 6379 ping

# Test slaves
redis-cli -p 6380 ping
redis-cli -p 6381 ping

# Test sentinels
redis-cli -p 26379 ping
redis-cli -p 26380 ping
redis-cli -p 26381 ping
```

#### Test Replication
```bash
# Write to master
redis-cli -p 6379 set test_key "hello world"

# Read from slaves
redis-cli -p 6380 get test_key
redis-cli -p 6381 get test_key
```

#### Test Sentinel
```bash
# Get master info
redis-cli -p 26379 SENTINEL masters

# Get slaves info
redis-cli -p 26379 SENTINEL slaves mymaster

# Trigger manual failover
redis-cli -p 26379 SENTINEL failover mymaster
```

## 📊 Monitoring

### Metrics Available

#### Redis Metrics (Port 9121)
- Connection stats
- Memory usage
- Command statistics
- Replication lag
- Keyspace statistics

#### Key Metrics to Monitor
```promql
# Redis memory usage
redis_memory_used_bytes

# Connection count
redis_connected_clients

# Commands per second
rate(redis_commands_processed_total[5m])

# Replication lag
redis_replication_lag_bytes

# Master/slave status
redis_instance_info{role="master"}
```

### Grafana Dashboard

Import the Redis dashboard or create custom panels:

```json
{
  "title": "Redis HA Overview",
  "panels": [
    {
      "title": "Memory Usage",
      "targets": [{"expr": "redis_memory_used_bytes"}]
    },
    {
      "title": "Connected Clients", 
      "targets": [{"expr": "redis_connected_clients"}]
    },
    {
      "title": "Commands/sec",
      "targets": [{"expr": "rate(redis_commands_processed_total[5m])"}]
    }
  ]
}
```

### Alerting Rules

```yaml
# Redis alerts
groups:
  - name: redis-ha
    rules:
      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 5m
        annotations:
          summary: "Redis instance is down"
          
      - alert: RedisHighMemoryUsage
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.8
        for: 5m
        annotations:
          summary: "Redis memory usage is high"
          
      - alert: RedisMasterChanged
        expr: changes(redis_instance_info{role="master"}[5m]) > 0
        annotations:
          summary: "Redis master has changed (failover occurred)"
```

## 🔧 Operations

### Scaling Operations

#### Add New Slave
1. Start new Redis instance with slave configuration
2. Configure replication: `SLAVEOF <master-ip> <master-port>`
3. Update monitoring and service discovery

#### Add New Sentinel
1. Start new Sentinel with proper configuration
2. Update quorum if needed
3. Update client configurations with new Sentinel

### Maintenance Operations

#### Planned Master Switchover
```bash
# Switch master to specific slave
redis-cli -p 26379 SENTINEL failover mymaster
```

#### Redis Configuration Update
```bash
# Update configuration via CONFIG SET
redis-cli -p 6379 CONFIG SET save "900 1 300 10"

# Make persistent
redis-cli -p 6379 CONFIG REWRITE
```

#### Backup Operations
```bash
# Create manual backup
redis-cli -p 6379 BGSAVE

# Check backup status
redis-cli -p 6379 LASTSAVE
```

### Troubleshooting

#### Common Issues

1. **Split Brain Prevention**
   - Ensure odd number of Sentinels (3, 5, 7)
   - Set appropriate quorum (majority)
   - Monitor network partitions

2. **Replication Lag**
   ```bash
   # Check replication status
   redis-cli -p 6379 INFO replication
   redis-cli -p 6380 INFO replication
   ```

3. **Memory Issues**
   ```bash
   # Check memory usage
   redis-cli -p 6379 INFO memory
   
   # Set memory policy
   redis-cli -p 6379 CONFIG SET maxmemory-policy allkeys-lru
   ```

4. **Sentinel Issues**
   ```bash
   # Check Sentinel logs
   docker logs redis-sentinel-1
   
   # Reset Sentinel
   redis-cli -p 26379 SENTINEL reset mymaster
   ```

#### Health Check Commands

```bash
# Quick health check script
for port in 6379 6380 6381; do
  echo "Redis $port: $(redis-cli -p $port ping)"
done

for port in 26379 26380 26381; do
  echo "Sentinel $port: $(redis-cli -p $port ping)"
done
```

## 🔒 Security Considerations

### Authentication
```bash
# Set password on master (will replicate to slaves)
redis-cli -p 6379 CONFIG SET requirepass "your-strong-password"

# Set password for master auth on slaves
redis-cli -p 6380 CONFIG SET masterauth "your-strong-password"
redis-cli -p 6381 CONFIG SET masterauth "your-strong-password"
```

### Network Security
- Use private networks for Redis communication
- Implement firewall rules
- Consider Redis AUTH and ACL (Redis 6+)
- Use TLS for Redis connections in production

### Access Control
```bash
# Create users (Redis 6+)
redis-cli -p 6379 ACL SETUSER app-user on >password +@read +@write -@dangerous ~*
```

## 🚀 Production Deployment

### Resource Requirements

#### Minimum Resources
- **Master**: 2 CPU cores, 4GB RAM, 50GB SSD
- **Slaves**: 1 CPU core, 2GB RAM, 50GB SSD  
- **Sentinels**: 0.5 CPU core, 512MB RAM, 10GB disk

#### Recommended Production
- **Master**: 4 CPU cores, 8GB RAM, 100GB SSD
- **Slaves**: 2 CPU cores, 4GB RAM, 100GB SSD
- **Sentinels**: 1 CPU core, 1GB RAM, 20GB SSD

### High Availability Checklist
- [ ] Deploy across multiple availability zones
- [ ] Configure automated backups
- [ ] Set up monitoring and alerting
- [ ] Test failover procedures
- [ ] Document runbooks
- [ ] Configure log shipping
- [ ] Implement access controls
- [ ] Set up network security

## 📚 References

- [Redis Sentinel Documentation](https://redis.io/topics/sentinel)
- [Redis High Availability](https://redis.io/topics/high-availability)
- [Redis Replication](https://redis.io/topics/replication)
- [Redis Security](https://redis.io/topics/security)
- [Redis Monitoring](https://redis.io/topics/monitoring)

## 🐛 Troubleshooting

### Getting Help
1. Check the test script output: `./scripts/test_redis_ha.sh`
2. Review Docker logs: `docker-compose -f docker-compose.redis-ha.yml logs`
3. Check Redis logs: `redis-cli -p 6379 MONITOR`
4. Review Sentinel logs: `redis-cli -p 26379 SENTINEL masters`

### Common Commands
```bash
# Check cluster status
./scripts/test_redis_ha.sh

# View logs
docker-compose -f docker-compose.redis-ha.yml logs -f

# Restart services
docker-compose -f docker-compose.redis-ha.yml restart

# Clean restart
docker-compose -f docker-compose.redis-ha.yml down
docker-compose -f docker-compose.redis-ha.yml up -d
```
