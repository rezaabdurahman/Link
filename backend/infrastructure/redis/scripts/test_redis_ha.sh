#!/bin/bash

# Redis HA Test Script
# This script tests Redis High Availability setup with Sentinel failover

set -e

# Configuration
REDIS_MASTER_PORT=6379
REDIS_SLAVE_1_PORT=6380
REDIS_SLAVE_2_PORT=6381
SENTINEL_1_PORT=26379
SENTINEL_2_PORT=26380
SENTINEL_3_PORT=26381
MASTER_NAME="mymaster"
TEST_KEY_PREFIX="ha_test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Testing Redis High Availability Setup${NC}"
echo "=============================================="
echo ""

# Function to test Redis connection
test_redis_connection() {
    local port=$1
    local description=$2
    
    echo -e "${YELLOW}Testing $description (port $port)...${NC}"
    
    if redis-cli -p $port ping | grep -q PONG; then
        echo -e "${GREEN}✓ $description is responsive${NC}"
        
        # Get server info
        role=$(redis-cli -p $port INFO replication | grep "role:" | cut -d: -f2 | tr -d '\r')
        echo "  Role: $role"
        
        if [ "$role" = "master" ]; then
            connected_slaves=$(redis-cli -p $port INFO replication | grep "connected_slaves:" | cut -d: -f2 | tr -d '\r')
            echo "  Connected slaves: $connected_slaves"
        elif [ "$role" = "slave" ]; then
            master_host=$(redis-cli -p $port INFO replication | grep "master_host:" | cut -d: -f2 | tr -d '\r')
            master_port=$(redis-cli -p $port INFO replication | grep "master_port:" | cut -d: -f2 | tr -d '\r')
            master_link_status=$(redis-cli -p $port INFO replication | grep "master_link_status:" | cut -d: -f2 | tr -d '\r')
            echo "  Master: $master_host:$master_port"
            echo "  Master link: $master_link_status"
        fi
    else
        echo -e "${RED}✗ $description is not responsive${NC}"
        return 1
    fi
    echo ""
}

# Function to test Sentinel connection
test_sentinel_connection() {
    local port=$1
    local description=$2
    
    echo -e "${YELLOW}Testing $description (port $port)...${NC}"
    
    if redis-cli -p $port ping | grep -q PONG; then
        echo -e "${GREEN}✓ $description is responsive${NC}"
        
        # Get master info from Sentinel
        master_info=$(redis-cli -p $port SENTINEL masters | head -20)
        echo "  Master info:"
        echo "$master_info" | grep -E "(name|ip|port|flags|num-slaves|num-other-sentinels)" | sed 's/^/    /'
        
        # Get other sentinels
        other_sentinels=$(redis-cli -p $port SENTINEL sentinels $MASTER_NAME)
        sentinel_count=$(echo "$other_sentinels" | wc -l)
        echo "  Other sentinels: $((sentinel_count / 10))"
    else
        echo -e "${RED}✗ $description is not responsive${NC}"
        return 1
    fi
    echo ""
}

# Function to test data replication
test_replication() {
    echo -e "${YELLOW}Testing data replication...${NC}"
    
    # Write to master
    test_key="${TEST_KEY_PREFIX}_replication_$(date +%s)"
    test_value="replication_test_$(date +%s)"
    
    echo "Writing to master: $test_key = $test_value"
    redis-cli -p $REDIS_MASTER_PORT SET "$test_key" "$test_value" > /dev/null
    
    # Wait a moment for replication
    sleep 2
    
    # Check slaves
    for port in $REDIS_SLAVE_1_PORT $REDIS_SLAVE_2_PORT; do
        echo "Checking slave on port $port..."
        value=$(redis-cli -p $port GET "$test_key")
        if [ "$value" = "$test_value" ]; then
            echo -e "${GREEN}✓ Data replicated to slave on port $port${NC}"
        else
            echo -e "${RED}✗ Data NOT replicated to slave on port $port (got: '$value')${NC}"
            return 1
        fi
    done
    
    # Clean up
    redis-cli -p $REDIS_MASTER_PORT DEL "$test_key" > /dev/null
    echo -e "${GREEN}✓ Replication test passed${NC}"
    echo ""
}

# Function to get current master from Sentinel
get_current_master() {
    redis-cli -p $SENTINEL_1_PORT SENTINEL get-master-addr-by-name $MASTER_NAME | head -1
}

# Function to test Sentinel failover
test_failover() {
    echo -e "${YELLOW}Testing Sentinel failover...${NC}"
    
    # Get current master
    current_master=$(get_current_master)
    echo "Current master: $current_master"
    
    # Write test data before failover
    test_key="${TEST_KEY_PREFIX}_failover_$(date +%s)"
    test_value="failover_test_$(date +%s)"
    echo "Writing test data: $test_key = $test_value"
    redis-cli -h $current_master -p 6379 SET "$test_key" "$test_value" > /dev/null
    
    # Trigger manual failover
    echo "Triggering manual failover..."
    redis-cli -p $SENTINEL_1_PORT SENTINEL failover $MASTER_NAME > /dev/null
    
    # Wait for failover to complete
    echo "Waiting for failover to complete..."
    sleep 10
    
    # Check new master
    new_master=$(get_current_master)
    echo "New master: $new_master"
    
    if [ "$current_master" != "$new_master" ]; then
        echo -e "${GREEN}✓ Failover successful: $current_master -> $new_master${NC}"
        
        # Test that data is still available
        value=$(redis-cli -h $new_master -p 6379 GET "$test_key")
        if [ "$value" = "$test_value" ]; then
            echo -e "${GREEN}✓ Data preserved during failover${NC}"
        else
            echo -e "${RED}✗ Data lost during failover${NC}"
            return 1
        fi
        
        # Clean up
        redis-cli -h $new_master -p 6379 DEL "$test_key" > /dev/null
    else
        echo -e "${RED}✗ Failover failed - master unchanged${NC}"
        return 1
    fi
    echo ""
}

# Function to test write during failover
test_write_during_failover() {
    echo -e "${YELLOW}Testing write operations during failover...${NC}"
    
    # Start background writes
    test_key="${TEST_KEY_PREFIX}_write_test"
    write_count=0
    error_count=0
    
    (
        for i in {1..30}; do
            if redis-cli -h $(get_current_master) -p 6379 SET "${test_key}_$i" "value_$i" > /dev/null 2>&1; then
                ((write_count++))
            else
                ((error_count++))
            fi
            sleep 1
        done
    ) &
    write_pid=$!
    
    # Wait a bit then trigger failover
    sleep 5
    echo "Triggering failover during writes..."
    redis-cli -p $SENTINEL_1_PORT SENTINEL failover $MASTER_NAME > /dev/null
    
    # Wait for writes to complete
    wait $write_pid
    
    echo "Write operations completed: $write_count successful, $error_count failed"
    
    if [ $error_count -lt 10 ]; then
        echo -e "${GREEN}✓ Write operations mostly successful during failover${NC}"
    else
        echo -e "${YELLOW}⚠ High error rate during failover: $error_count errors${NC}"
    fi
    
    # Clean up test keys
    for i in {1..30}; do
        redis-cli -h $(get_current_master) -p 6379 DEL "${test_key}_$i" > /dev/null 2>&1
    done
    echo ""
}

# Function to test Redis performance
test_performance() {
    echo -e "${YELLOW}Testing Redis performance...${NC}"
    
    current_master=$(get_current_master)
    
    # Run benchmark
    echo "Running redis-benchmark on master $current_master..."
    redis-benchmark -h $current_master -p 6379 -n 1000 -c 10 -q | head -10
    echo ""
}

# Function to test Redis memory usage
test_memory_usage() {
    echo -e "${YELLOW}Testing Redis memory usage...${NC}"
    
    for port in $REDIS_MASTER_PORT $REDIS_SLAVE_1_PORT $REDIS_SLAVE_2_PORT; do
        memory_info=$(redis-cli -p $port INFO memory | grep -E "(used_memory_human|used_memory_peak_human|maxmemory_human)")
        echo "Port $port memory usage:"
        echo "$memory_info" | sed 's/^/  /'
    done
    echo ""
}

# Function to test Sentinel consensus
test_sentinel_consensus() {
    echo -e "${YELLOW}Testing Sentinel consensus...${NC}"
    
    for port in $SENTINEL_1_PORT $SENTINEL_2_PORT $SENTINEL_3_PORT; do
        echo "Sentinel $port view:"
        master_addr=$(redis-cli -p $port SENTINEL get-master-addr-by-name $MASTER_NAME)
        echo "  Master: $master_addr"
        
        slaves_count=$(redis-cli -p $port SENTINEL slaves $MASTER_NAME | wc -l)
        echo "  Slaves: $((slaves_count / 10))"
        
        sentinels_count=$(redis-cli -p $port SENTINEL sentinels $MASTER_NAME | wc -l)
        echo "  Other Sentinels: $((sentinels_count / 10))"
    done
    echo ""
}

# Main test execution
main() {
    echo "Starting Redis HA comprehensive tests..."
    echo ""
    
    # Test basic connectivity
    echo -e "${BLUE}=== Basic Connectivity Tests ===${NC}"
    test_redis_connection $REDIS_MASTER_PORT "Redis Master"
    test_redis_connection $REDIS_SLAVE_1_PORT "Redis Slave 1"
    test_redis_connection $REDIS_SLAVE_2_PORT "Redis Slave 2"
    
    test_sentinel_connection $SENTINEL_1_PORT "Sentinel 1"
    test_sentinel_connection $SENTINEL_2_PORT "Sentinel 2"
    test_sentinel_connection $SENTINEL_3_PORT "Sentinel 3"
    
    # Test replication
    echo -e "${BLUE}=== Replication Tests ===${NC}"
    test_replication
    
    # Test Sentinel consensus
    echo -e "${BLUE}=== Sentinel Consensus Tests ===${NC}"
    test_sentinel_consensus
    
    # Test failover
    echo -e "${BLUE}=== Failover Tests ===${NC}"
    test_failover
    sleep 5  # Wait for system to stabilize
    
    # Test writes during failover
    test_write_during_failover
    sleep 5  # Wait for system to stabilize
    
    # Performance and monitoring tests
    echo -e "${BLUE}=== Performance and Monitoring Tests ===${NC}"
    test_performance
    test_memory_usage
    
    # Final summary
    echo -e "${GREEN}🎉 Redis HA tests completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Monitor logs: docker-compose -f docker-compose.redis-ha.yml logs -f"
    echo "2. Check Redis Commander UI: http://localhost:8081 (admin/admin)"
    echo "3. Monitor metrics: http://localhost:9121/metrics"
    echo "4. Check Prometheus: http://localhost:9090"
    echo "5. View Grafana dashboards: http://localhost:3001"
}

# Check dependencies
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}redis-cli is required but not installed${NC}"
    echo "Install with: brew install redis (macOS) or apt-get install redis-tools (Ubuntu)"
    exit 1
fi

# Check if Redis HA stack is running
if ! redis-cli -p $REDIS_MASTER_PORT ping > /dev/null 2>&1; then
    echo -e "${RED}Redis HA stack is not running${NC}"
    echo "Start with: cd backend/infrastructure/redis && docker-compose -f docker-compose.redis-ha.yml up -d"
    exit 1
fi

# Run main function
main "$@"
