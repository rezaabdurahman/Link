#!/bin/bash
set -e

echo "Starting PgBouncer configuration..."

# Function to generate MD5 hash for PgBouncer authentication
generate_md5_hash() {
    local username=$1
    local password=$2
    echo "md5$(echo -n "$password$username" | md5sum | cut -d' ' -f1)"
}

# Create userlist.txt with actual password hashes
cat > /etc/pgbouncer/userlist.txt << EOF
; PgBouncer user list - Generated at startup
; Format: "username" "password_hash"

; Service users
"user_service_user" "$(generate_md5_hash "user_service_user" "${USER_SERVICE_DB_PASSWORD}")"
"chat_service_user" "$(generate_md5_hash "chat_service_user" "${CHAT_SERVICE_DB_PASSWORD}")"
"ai_service_user" "$(generate_md5_hash "ai_service_user" "${AI_SERVICE_DB_PASSWORD}")"
"discovery_service_user" "$(generate_md5_hash "discovery_service_user" "${DISCOVERY_SERVICE_DB_PASSWORD}")"
"search_service_user" "$(generate_md5_hash "search_service_user" "${SEARCH_SERVICE_DB_PASSWORD}")"
"location_service_user" "$(generate_md5_hash "location_service_user" "${LOCATION_SERVICE_DB_PASSWORD}")"
"stories_service_user" "$(generate_md5_hash "stories_service_user" "${STORIES_SERVICE_DB_PASSWORD}")"
"opportunities_service_user" "$(generate_md5_hash "opportunities_service_user" "${OPPORTUNITIES_SERVICE_DB_PASSWORD}")"

; Legacy user for migration period
"linkuser" "$(generate_md5_hash "linkuser" "${DB_PASSWORD:-linkpass}")"

; Admin users
"pgbouncer_admin" "$(generate_md5_hash "pgbouncer_admin" "${PGBOUNCER_ADMIN_PASSWORD:-admin_password_change_me}")"
"pgbouncer_stats" "$(generate_md5_hash "pgbouncer_stats" "${PGBOUNCER_STATS_PASSWORD:-stats_password_change_me}")"
EOF

echo "Generated userlist.txt with $(grep -c '^"' /etc/pgbouncer/userlist.txt) users"

# Set proper permissions
chmod 600 /etc/pgbouncer/userlist.txt
chmod 644 /etc/pgbouncer/pgbouncer.ini

# Health check function
health_check() {
    if ! pg_isready -h localhost -p 5432 -q; then
        echo "ERROR: PgBouncer is not responding to health checks"
        exit 1
    fi
}

# Start PgBouncer
echo "Starting PgBouncer..."
exec pgbouncer /etc/pgbouncer/pgbouncer.ini
