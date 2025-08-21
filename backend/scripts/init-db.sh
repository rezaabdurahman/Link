#!/bin/bash
set -e

# PostgreSQL Database Initialization Script
# This script creates the database user and database with proper permissions
# It uses environment variables for secure credential management

# Default values (should match docker-compose.yml defaults)
DB_USER="${POSTGRES_USER:-linkuser}"
DB_PASSWORD="${POSTGRES_PASSWORD:-linkpass}"  
DB_NAME="${DB_NAME:-linkdb}"
APP_ENV="${APP_ENV:-development}"

echo "🔧 Initializing PostgreSQL database for environment: ${APP_ENV}"
echo "📊 Database: ${DB_NAME}"
echo "👤 User: ${DB_USER}"

# Function to execute SQL with error handling
execute_sql() {
    local sql="$1"
    local description="$2"
    
    echo "⚡ ${description}..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        $sql
EOSQL
    echo "✅ ${description} completed"
}

# Create application user with appropriate permissions
# Note: We avoid SUPERUSER for security - use specific grants instead
execute_sql "
    -- Create application user if it doesn't exist
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
            CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
            RAISE NOTICE 'User ${DB_USER} created';
        ELSE
            -- Update password in case it changed
            ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
            RAISE NOTICE 'User ${DB_USER} password updated';
        END IF;
    END
    \$\$;
" "Creating application user"

# Create application database if it doesn't exist
execute_sql "
    -- Create database if it doesn't exist
    SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}' 
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\\gexec
" "Creating application database"

# Connect to the application database and set up permissions
export PGDATABASE="${DB_NAME}"

execute_sql "
    -- Grant necessary permissions to application user
    GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};
    GRANT USAGE ON SCHEMA public TO ${DB_USER};
    GRANT CREATE ON SCHEMA public TO ${DB_USER};
    
    -- Grant permissions on existing tables (for migrations)
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};
    
    -- Grant permissions on future tables (for new migrations)
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO ${DB_USER};
" "Setting up database permissions"

# Enable required extensions
execute_sql "
    -- Enable UUID extension for primary keys
    CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
    
    -- Enable PostgreSQL trigram extension for search
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    
    -- Enable unaccent extension for search normalization  
    CREATE EXTENSION IF NOT EXISTS unaccent;
" "Installing required PostgreSQL extensions"

# Environment-specific setup
if [ "$APP_ENV" = "development" ]; then
    execute_sql "
        -- Development environment specific setup
        
        -- Enable statement logging for debugging
        ALTER SYSTEM SET log_statement = 'all';
        ALTER SYSTEM SET log_min_duration_statement = 0;
        
        -- Reload configuration
        SELECT pg_reload_conf();
    " "Configuring development environment"
    
elif [ "$APP_ENV" = "production" ]; then
    execute_sql "
        -- Production environment specific setup
        
        -- Optimize for performance
        ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
        ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log slow queries only
        ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
        ALTER SYSTEM SET log_checkpoints = on;
        ALTER SYSTEM SET log_connections = on;
        ALTER SYSTEM SET log_disconnections = on;
        ALTER SYSTEM SET log_lock_waits = on;
        
        -- Create pg_stat_statements extension for query monitoring
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
        
        -- Reload configuration
        SELECT pg_reload_conf();
    " "Configuring production environment"
fi

echo "🎉 Database initialization completed successfully!"
echo "📋 Summary:"
echo "   • Database '${DB_NAME}' is ready"
echo "   • User '${DB_USER}' has been configured"
echo "   • Required extensions installed"
echo "   • Environment: ${APP_ENV}"