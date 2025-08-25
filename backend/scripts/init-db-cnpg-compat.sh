#!/bin/bash
# CloudNativePG-Compatible Database Initialization Script for Local Development
# This script creates the same database structure as the CloudNativePG cluster
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable pg_stat_statements extension
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    
    -- Create service-specific databases
    CREATE DATABASE user_service_db OWNER $POSTGRES_USER;
    CREATE DATABASE chat_service_db OWNER $POSTGRES_USER;
    CREATE DATABASE discovery_service_db OWNER $POSTGRES_USER;
    CREATE DATABASE search_service_db OWNER $POSTGRES_USER;
    CREATE DATABASE ai_service_db OWNER $POSTGRES_USER;
    CREATE DATABASE feature_service_db OWNER $POSTGRES_USER;
    
    -- Create service-specific users with SCRAM-SHA-256 authentication
    CREATE USER user_service_user WITH ENCRYPTED PASSWORD '${USER_SERVICE_PASSWORD:-user_svc_pass}';
    CREATE USER chat_service_user WITH ENCRYPTED PASSWORD '${CHAT_SERVICE_PASSWORD:-chat_svc_pass}';
    CREATE USER discovery_service_user WITH ENCRYPTED PASSWORD '${DISCOVERY_SERVICE_PASSWORD:-discovery_svc_pass}';
    CREATE USER search_service_user WITH ENCRYPTED PASSWORD '${SEARCH_SERVICE_PASSWORD:-search_svc_pass}';
    CREATE USER ai_service_user WITH ENCRYPTED PASSWORD '${AI_SERVICE_PASSWORD:-ai_svc_pass}';
    CREATE USER feature_service_user WITH ENCRYPTED PASSWORD '${FEATURE_SERVICE_PASSWORD:-feature_svc_pass}';
    
    -- Grant database permissions
    GRANT ALL PRIVILEGES ON DATABASE user_service_db TO user_service_user;
    GRANT ALL PRIVILEGES ON DATABASE chat_service_db TO chat_service_user;
    GRANT ALL PRIVILEGES ON DATABASE discovery_service_db TO discovery_service_user;
    GRANT ALL PRIVILEGES ON DATABASE search_service_db TO search_service_user;
    GRANT ALL PRIVILEGES ON DATABASE ai_service_db TO ai_service_user;
    GRANT ALL PRIVILEGES ON DATABASE feature_service_db TO feature_service_user;
    
    -- Create admin users for monitoring/management
    CREATE USER pgbouncer_admin WITH ENCRYPTED PASSWORD 'admin_password_change_me';
    CREATE USER pgbouncer_stats WITH ENCRYPTED PASSWORD 'stats_password_change_me';
    CREATE USER prometheus_exporter WITH ENCRYPTED PASSWORD 'prometheus_password_change_me';
    
    -- Grant necessary permissions to admin users
    GRANT pg_monitor TO prometheus_exporter;
    GRANT pg_read_all_stats TO pgbouncer_stats;
EOSQL

# Initialize each service database with pg_stat_statements
for db in user_service_db chat_service_db discovery_service_db search_service_db ai_service_db feature_service_db; do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<-EOSQL
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EOSQL
done

echo "✅ CloudNativePG-compatible database initialization completed"
echo "📊 Created databases: user_service_db, chat_service_db, discovery_service_db, search_service_db, ai_service_db, feature_service_db"
echo "👥 Created service users with SCRAM-SHA-256 authentication"
echo "🔧 Enabled pg_stat_statements extension"