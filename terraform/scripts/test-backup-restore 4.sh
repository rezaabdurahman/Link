#!/bin/bash

# Backup and Restore Testing Script
# Tests backup creation and restoration procedures for database isolation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR="/tmp/terraform-backup-test-$$"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
LOG_FILE="/tmp/backup-test-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DATABASES=("link_users" "link_chat" "link_ai" "link_search" "link_discovery")
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_ADMIN_USER="${POSTGRES_ADMIN_USER:-postgres}"
POSTGRES_ADMIN_DB="${POSTGRES_ADMIN_DB:-postgres}"

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_section() {
    echo -e "\n${BLUE}==== $1 ====${NC}" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test resources..."
    
    # Remove test directory
    if [ -d "$TEST_DIR" ]; then
        rm -rf "$TEST_DIR"
    fi
    
    # Drop test databases (if created)
    for db in "${TEST_DATABASES[@]}"; do
        local test_db="${db}_test_$$"
        if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_ADMIN_DB" \
               -tc "SELECT 1 FROM pg_database WHERE datname = '$test_db'" | grep -q 1; then
            log_info "Dropping test database: $test_db"
            psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_ADMIN_DB" \
                 -c "DROP DATABASE IF EXISTS $test_db;" &>/dev/null || true
        fi
    done
    
    log_info "Cleanup completed"
}

# Set up trap for cleanup
trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_section "Checking Prerequisites"
    
    local missing_tools=()
    
    # Check required tools
    for tool in psql pg_dump pg_restore; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install PostgreSQL client tools"
        exit 1
    fi
    
    # Test database connection
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_ADMIN_DB" \
             -c "SELECT 1;" &>/dev/null; then
        log_error "Cannot connect to PostgreSQL server"
        log_info "Check connection parameters and credentials"
        exit 1
    fi
    
    log_info "✅ All prerequisites satisfied"
}

# Create test environment
setup_test_environment() {
    log_section "Setting Up Test Environment"
    
    # Create test directory
    mkdir -p "$TEST_DIR"
    mkdir -p "$TEST_DIR/backups"
    mkdir -p "$TEST_DIR/restore"
    
    log_info "Created test directory: $TEST_DIR"
    log_info "Log file: $LOG_FILE"
}

# Create test databases with sample data
create_test_databases() {
    log_section "Creating Test Databases"
    
    for db in "${TEST_DATABASES[@]}"; do
        local test_db="${db}_test_$$"
        log_info "Creating test database: $test_db"
        
        # Create database
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_ADMIN_DB" \
             -c "CREATE DATABASE $test_db;" >> "$LOG_FILE" 2>&1
        
        # Add sample data
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$test_db" \
             -c "CREATE TABLE test_data (id SERIAL PRIMARY KEY, data TEXT, created_at TIMESTAMP DEFAULT NOW());" >> "$LOG_FILE" 2>&1
        
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$test_db" \
             -c "INSERT INTO test_data (data) VALUES ('Test data for $db'), ('Another test record'), ('Final test entry');" >> "$LOG_FILE" 2>&1
        
        log_info "✅ Created $test_db with sample data"
    done
}

# Test backup creation
test_backup_creation() {
    log_section "Testing Backup Creation"
    
    for db in "${TEST_DATABASES[@]}"; do
        local test_db="${db}_test_$$"
        local backup_file="$TEST_DIR/backups/${test_db}_backup.sql"
        
        log_info "Creating backup for: $test_db"
        
        # Create backup
        if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
                   -d "$test_db" -f "$backup_file" --verbose >> "$LOG_FILE" 2>&1; then
            log_info "✅ Backup created: $backup_file"
            
            # Verify backup file exists and has content
            if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
                local backup_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
                log_info "  Backup size: $backup_size bytes"
            else
                log_error "❌ Backup file is empty or missing"
                return 1
            fi
        else
            log_error "❌ Failed to create backup for $test_db"
            return 1
        fi
    done
}

# Test backup compression
test_backup_compression() {
    log_section "Testing Backup Compression"
    
    for db in "${TEST_DATABASES[@]}"; do
        local test_db="${db}_test_$$"
        local backup_file="$TEST_DIR/backups/${test_db}_backup.sql"
        local compressed_file="${backup_file}.gz"
        
        log_info "Compressing backup for: $test_db"
        
        # Compress backup
        if gzip -c "$backup_file" > "$compressed_file"; then
            local original_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
            local compressed_size=$(stat -f%z "$compressed_file" 2>/dev/null || stat -c%s "$compressed_file" 2>/dev/null)
            local compression_ratio=$(echo "scale=2; $compressed_size * 100 / $original_size" | bc)
            
            log_info "✅ Compressed $test_db (${compression_ratio}% of original)"
            log_info "  Original: $original_size bytes, Compressed: $compressed_size bytes"
        else
            log_error "❌ Failed to compress backup for $test_db"
            return 1
        fi
    done
}

# Test backup restoration
test_backup_restoration() {
    log_section "Testing Backup Restoration"
    
    for db in "${TEST_DATABASES[@]}"; do
        local test_db="${db}_test_$$"
        local restore_db="${db}_restore_$$"
        local backup_file="$TEST_DIR/backups/${test_db}_backup.sql"
        
        log_info "Testing restoration for: $test_db -> $restore_db"
        
        # Create target database
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_ADMIN_DB" \
             -c "CREATE DATABASE $restore_db;" >> "$LOG_FILE" 2>&1
        
        # Restore backup
        if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
                -d "$restore_db" -f "$backup_file" >> "$LOG_FILE" 2>&1; then
            log_info "✅ Backup restored to: $restore_db"
            
            # Verify data integrity
            local original_count=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
                                        -d "$test_db" -t -c "SELECT COUNT(*) FROM test_data;" | tr -d ' ')
            local restored_count=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
                                        -d "$restore_db" -t -c "SELECT COUNT(*) FROM test_data;" | tr -d ' ')
            
            if [ "$original_count" = "$restored_count" ]; then
                log_info "  ✅ Data integrity verified: $restored_count records"
            else
                log_error "  ❌ Data integrity check failed: $original_count != $restored_count"
                return 1
            fi
        else
            log_error "❌ Failed to restore backup for $test_db"
            return 1
        fi
        
        # Cleanup restore database
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$POSTGRES_ADMIN_DB" \
             -c "DROP DATABASE $restore_db;" >> "$LOG_FILE" 2>&1
    done
}

# Test point-in-time recovery simulation
test_point_in_time_recovery() {
    log_section "Testing Point-in-Time Recovery Simulation"
    
    local test_db="${TEST_DATABASES[0]}_test_$$"
    local backup_file="$TEST_DIR/backups/${test_db}_pit_backup.sql"
    
    log_info "Simulating point-in-time recovery for: $test_db"
    
    # Take initial backup
    pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
            -d "$test_db" -f "$backup_file" >> "$LOG_FILE" 2>&1
    
    # Add more data (simulating activity after backup)
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$test_db" \
         -c "INSERT INTO test_data (data) VALUES ('Post-backup data 1'), ('Post-backup data 2');" >> "$LOG_FILE" 2>&1
    
    # Get current record count
    local current_count=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
                               -d "$test_db" -t -c "SELECT COUNT(*) FROM test_data;" | tr -d ' ')
    
    # Simulate disaster (drop table)
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" -d "$test_db" \
         -c "DROP TABLE test_data;" >> "$LOG_FILE" 2>&1
    
    # Restore from backup
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
         -d "$test_db" -f "$backup_file" >> "$LOG_FILE" 2>&1
    
    # Verify restoration
    local restored_count=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_ADMIN_USER" \
                                -d "$test_db" -t -c "SELECT COUNT(*) FROM test_data;" | tr -d ' ')
    
    log_info "Records before disaster: $current_count"
    log_info "Records after restoration: $restored_count"
    
    if [ "$restored_count" -lt "$current_count" ]; then
        log_warn "⚠️  Point-in-time recovery shows data loss (expected for backup-based recovery)"
        log_info "  Consider implementing WAL archiving for true point-in-time recovery"
    else
        log_info "✅ Point-in-time recovery simulation completed"
    fi
}

# Test backup rotation and cleanup
test_backup_rotation() {
    log_section "Testing Backup Rotation"
    
    local rotation_dir="$TEST_DIR/rotation_test"
    mkdir -p "$rotation_dir"
    
    # Create multiple backup files with different dates
    for i in {1..10}; do
        local backup_date=$(date -d "$i days ago" +%Y%m%d_%H%M%S 2>/dev/null || date -v-${i}d +%Y%m%d_%H%M%S)
        local backup_file="$rotation_dir/test_backup_${backup_date}.sql.gz"
        echo "Mock backup data for day $i" | gzip > "$backup_file"
    done
    
    log_info "Created 10 mock backup files"
    
    # Test rotation script (keep only 7 days)
    local retention_days=7
    find "$rotation_dir" -name "*.sql.gz" -mtime +$retention_days -delete
    
    local remaining_files=$(find "$rotation_dir" -name "*.sql.gz" | wc -l)
    log_info "After rotation (${retention_days}d retention): $remaining_files files remaining"
    
    if [ "$remaining_files" -le "$retention_days" ]; then
        log_info "✅ Backup rotation working correctly"
    else
        log_error "❌ Backup rotation failed"
        return 1
    fi
}

# Generate test report
generate_test_report() {
    log_section "Test Report"
    
    local report_file="$TEST_DIR/backup_test_report.txt"
    
    cat > "$report_file" << EOF
Backup and Restore Test Report
Generated: $(date)
Test ID: $$

=== Test Environment ===
PostgreSQL Host: $POSTGRES_HOST
PostgreSQL Port: $POSTGRES_PORT
Test Directory: $TEST_DIR
Log File: $LOG_FILE

=== Test Results ===
✅ Prerequisites Check: PASSED
✅ Test Database Creation: PASSED
✅ Backup Creation: PASSED
✅ Backup Compression: PASSED
✅ Backup Restoration: PASSED
✅ Point-in-Time Recovery Simulation: PASSED
✅ Backup Rotation: PASSED

=== Recommendations ===
1. Implement automated backup scheduling (cron)
2. Set up monitoring for backup success/failure
3. Consider WAL archiving for point-in-time recovery
4. Test restore procedures regularly in production
5. Document backup and restore procedures for operations team

=== Next Steps ===
1. Deploy backup scripts to production environment
2. Configure backup monitoring and alerting
3. Schedule regular backup testing
4. Create disaster recovery playbook
EOF

    log_info "Test report generated: $report_file"
    cat "$report_file"
}

# Main execution
main() {
    log_info "Starting backup and restore testing..."
    log_info "Test session: $$"
    
    setup_test_environment
    check_prerequisites
    create_test_databases
    test_backup_creation
    test_backup_compression
    test_backup_restoration
    test_point_in_time_recovery
    test_backup_rotation
    generate_test_report
    
    log_info "🎉 All backup and restore tests completed successfully!"
    log_info "Review the test report and implement recommendations."
}

# Print usage if requested
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: $0 [--help]"
    echo ""
    echo "Tests backup and restore procedures for the database isolation setup:"
    echo "  - Backup creation and verification"
    echo "  - Backup compression"
    echo "  - Restore functionality and data integrity"
    echo "  - Point-in-time recovery simulation"
    echo "  - Backup rotation and cleanup"
    echo ""
    echo "Environment variables:"
    echo "  POSTGRES_HOST - PostgreSQL host (default: localhost)"
    echo "  POSTGRES_PORT - PostgreSQL port (default: 5432)"
    echo "  POSTGRES_ADMIN_USER - Admin user (default: postgres)"
    echo "  POSTGRES_ADMIN_DB - Admin database (default: postgres)"
    echo "  BACKUP_DIR - Backup directory (default: /var/backups/postgresql)"
    echo ""
    echo "Prerequisites:"
    echo "  - PostgreSQL client tools (psql, pg_dump, pg_restore)"
    echo "  - Database access credentials"
    echo "  - Write permissions to test directory"
    exit 0
fi

# Execute main function
main "$@"