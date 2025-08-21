# Database Migrations Guide

## Overview

The Link distributed architecture uses a **shared migration system** that provides consistent database schema management across all microservices. This system is built on top of GORM and supports schema versioning, integrity checking, and rollback capabilities.

## Key Features

- ✅ **Shared Migration Engine**: Centralized logic in `shared-libs/migrations/`
- ✅ **Schema Versioning**: Track schema versions per service
- ✅ **Integrity Verification**: Checksum validation for migration files
- ✅ **Transactional Execution**: Each migration runs in a database transaction
- ✅ **Rollback Support**: Safe rollback of the latest migration
- ✅ **Dry-Run Mode**: Test migrations without executing them
- ✅ **Docker Integration**: Automatic migration execution on container startup
- ✅ **Multi-Format Support**: Supports both `.up.sql` and `_up.sql` naming conventions

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discovery     │    │    AI Service   │    │  Chat Service   │
│   Service       │    │                 │    │                 │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Migrations  │ │    │ │ Migrations  │ │    │ │ Migrations  │ │
│ │ Engine      │◄┼────┼►│ Engine      │ │    │ │ Engine      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Shared Libs    │
                    │  Migrations     │
                    │  Package        │
                    └─────────────────┘
```

## File Structure

```
backend/
├── shared-libs/
│   └── migrations/
│       ├── engine.go          # Main migration engine
│       ├── types.go           # Type definitions
│       ├── utils.go           # Utilities and helpers
│       └── cmd/migrate/       # Standalone CLI tool
│           ├── main.go
│           └── go.mod
├── discovery-svc/
│   ├── migrations/
│   │   ├── 001_create_users.up.sql
│   │   ├── 001_create_users.down.sql
│   │   └── ...
│   └── cmd/migrate/main.go    # Service-specific wrapper
├── ai-svc/
│   ├── migrations/
│   │   ├── 001_create_ai_tables.up.sql
│   │   └── ...
│   └── cmd/migrate/main.go
└── chat-svc/
    ├── migrations/
    │   ├── 001_create_chat_tables.up.sql
    │   └── ...
    └── cmd/migrate/main.go
```

## Migration File Naming Convention

**Standard Format**: `NNN_description.{up|down}.sql`

Examples:
- ✅ `001_create_users_table.up.sql`
- ✅ `001_create_users_table.down.sql`
- ✅ `002_add_user_preferences.up.sql`
- ✅ `002_add_user_preferences.down.sql`

**Rules**:
- **Version Number**: 3-digit zero-padded number (001, 002, 003...)
- **Description**: Lowercase with underscores, descriptive of the change
- **Direction**: `.up.sql` for applying changes, `.down.sql` for rollbacks
- **Paired Files**: Every up migration should have a corresponding down migration

## Database Schema

The migration system creates two tracking tables:

### `migration_records`
Tracks individual applied migrations per service:
```sql
CREATE TABLE migration_records (
    id SERIAL PRIMARY KEY,
    service VARCHAR NOT NULL,
    version INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    checksum VARCHAR NOT NULL
);
```

### `schema_versions`
Tracks current schema version per service:
```sql
CREATE TABLE schema_versions (
    service VARCHAR PRIMARY KEY,
    version INTEGER NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    description VARCHAR
);
```

## Usage

### 1. **Running Migrations**

**Per Service (Recommended)**:
```bash
# From service directory
go run cmd/migrate/main.go -action=up

# With dry-run
go run cmd/migrate/main.go -action=up -dry-run

# Check status
go run cmd/migrate/main.go -action=status
```

**Using Shared CLI Tool**:
```bash
# From shared-libs/migrations/cmd/migrate/
go run main.go -service=discovery-svc -action=up
go run main.go -service=ai-svc -action=status
```

### 2. **Creating New Migrations**

**Generate Template Files**:
```bash
go run cmd/migrate/main.go -action=generate -description="add user preferences table"
```

This creates:
- `003_add_user_preferences_table.up.sql`
- `003_add_user_preferences_table.down.sql`

**Manual Creation**:
1. Find the next version number by checking existing files
2. Create both `.up.sql` and `.down.sql` files
3. Follow the naming convention

### 3. **Rolling Back Migrations**

```bash
# Rollback the latest migration
go run cmd/migrate/main.go -action=down

# Check what would be rolled back (dry-run)
go run cmd/migrate/main.go -action=down -dry-run
```

### 4. **Migration Status and Verification**

```bash
# Check migration status
go run cmd/migrate/main.go -action=status

# Verify migration integrity
go run cmd/migrate/main.go -action=verify
```

## Docker Integration

### Automatic Migrations

Each service runs migrations automatically on container startup:

1. **Container starts** → `docker-entrypoint.sh`
2. **Wait for database** → `nc -z postgres 5432`
3. **Run migrations** → `./migrate -action=up`
4. **Start service** → `./main`

### Manual Migration in Container

```bash
# Connect to running container
docker exec -it discovery-svc /bin/sh

# Run migration commands
./migrate -action=status
./migrate -action=up -dry-run
```

## Environment Variables

All services use the same database configuration:

```bash
DB_HOST=postgres         # Database host
DB_PORT=5432            # Database port  
DB_USER=linkuser        # Database user
DB_PASSWORD=linkpass    # Database password
DB_NAME=linkdb          # Database name
DB_SSLMODE=disable      # SSL mode
```

## Best Practices

### 1. **Migration Development Workflow**

Following your branching rules:

```bash
# 1. Create feature branch (never work on main)
git checkout -b feature/add-user-preferences

# 2. Generate migration files
go run cmd/migrate/main.go -action=generate -description="add user preferences"

# 3. Edit migration files
vim migrations/003_add_user_preferences.up.sql
vim migrations/003_add_user_preferences.down.sql

# 4. Test migrations locally
go run cmd/migrate/main.go -action=up -dry-run
go run cmd/migrate/main.go -action=up

# 5. Verify rollback works
go run cmd/migrate/main.go -action=down -dry-run

# 6. Commit with conventional commit format
git add migrations/
git commit -m "feat: add user preferences table migration"

# 7. Push to remote feature branch and create PR
git push origin feature/add-user-preferences
```

### 2. **Production Migration Guidelines**

- ✅ **Always test migrations** in staging environment first
- ✅ **Use dry-run mode** to validate before applying
- ✅ **Verify rollback** before deploying to production
- ✅ **Coordinate deployments** across services for breaking changes
- ✅ **Monitor migration execution** during deployment

### 3. **Writing Safe Migrations**

**DO**:
```sql
-- ✅ Add columns with defaults
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';

-- ✅ Create indexes concurrently (PostgreSQL)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- ✅ Use IF EXISTS/IF NOT EXISTS
CREATE TABLE IF NOT EXISTS user_sessions (...);
DROP INDEX IF EXISTS old_index_name;
```

**DON'T**:
```sql
-- ❌ Don't drop columns immediately (causes downtime)
ALTER TABLE users DROP COLUMN old_field;

-- ❌ Don't add NOT NULL columns without defaults
ALTER TABLE users ADD COLUMN required_field VARCHAR NOT NULL;

-- ❌ Don't rename columns without compatibility period
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

### 4. **Backward Compatibility Strategy**

For breaking schema changes, use a **multi-step approach**:

**Step 1: Add new field**
```sql
-- Migration 010: Add new field
ALTER TABLE users ADD COLUMN new_email VARCHAR;
```

**Step 2: Migrate data + Update application**
```sql
-- Migration 011: Populate new field
UPDATE users SET new_email = email WHERE new_email IS NULL;
```

**Step 3: Remove old field** (after confirming application works)
```sql
-- Migration 012: Remove old field
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users RENAME COLUMN new_email TO email;
```

## Service-Specific Migration Notes

### Discovery Service
- **Tables**: `user_availability`, ranking configurations
- **Features**: User discovery, availability tracking
- **Dependencies**: PostgreSQL only

### AI Service  
- **Tables**: `ai_conversations`, `ai_requests`, `ai_responses`, `ai_usage_stats`
- **Features**: AI chat history, usage tracking
- **Dependencies**: PostgreSQL only

### Chat Service
- **Tables**: `chat_rooms`, `messages`, `room_members`, `message_reads`
- **Features**: Real-time messaging, room management
- **Dependencies**: PostgreSQL + Redis

## Troubleshooting

### Common Issues

**1. Migration Fails to Apply**
```bash
# Check status and errors
go run cmd/migrate/main.go -action=status

# Verify file integrity
go run cmd/migrate/main.go -action=verify

# Test with dry-run first
go run cmd/migrate/main.go -action=up -dry-run
```

**2. Checksum Mismatch Warnings**
```bash
# This means migration files were modified after being applied
# Either revert the file changes or investigate the discrepancy
go run cmd/migrate/main.go -action=verify
```

**3. Database Connection Issues**
```bash
# Check environment variables
echo $DB_HOST $DB_PORT $DB_USER $DB_NAME

# Test connection manually
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
```

**4. Container Migration Failures**
```bash
# Check container logs
docker logs discovery-svc

# Connect to container and debug
docker exec -it discovery-svc /bin/sh
./migrate -action=status
```

### Recovery Procedures

**1. Failed Migration (Partial Apply)**
```bash
# Check what was applied
go run cmd/migrate/main.go -action=status

# Manual cleanup may be required in database
# Then mark migration as not applied and retry
```

**2. Rollback Issues**
```bash
# Ensure down migration file exists and is correct
ls migrations/*down.sql

# Test rollback with dry-run first
go run cmd/migrate/main.go -action=down -dry-run
```

## Integration with CI/CD

### Pre-commit Hooks
```bash
# Validate migration files before commit
find . -name "*.sql" -exec sqlcheck {} \;

# Verify naming convention
./scripts/validate_migration_names.sh
```

### Deployment Pipeline
```yaml
# Example CI step
- name: Run Migration Tests
  run: |
    # Test migrations in isolated database
    docker-compose -f docker-compose.test.yml up -d postgres-test
    
    # Test each service migration
    go run discovery-svc/cmd/migrate/main.go -action=up -dry-run
    go run ai-svc/cmd/migrate/main.go -action=up -dry-run
    go run chat-svc/cmd/migrate/main.go -action=up -dry-run
```

## Advanced Usage

### Custom Configuration

```go
// In service code, you can customize the migration engine
engine := migrations.NewMigrationEngine(db, "my-service", "./migrations")

config := &migrations.Config{
    DryRun:           false,
    UseTransactions:  true,
    MigrationTimeout: 10 * time.Minute,
}

engine = engine.WithConfig(config)
```

### Programmatic Usage

```go
// Get migration status programmatically
status, err := engine.GetStatus()
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Service: %s, Current Version: %d, Pending: %d\n", 
    status.Service, status.CurrentVersion, status.Pending)
```

### Multi-Service Migration Status

```bash
# Check status across all services
for service in discovery-svc ai-svc chat-svc; do
    echo "=== $service ==="
    go run shared-libs/migrations/cmd/migrate/main.go -service=$service -action=status
done
```

## Security Considerations

- 🔒 **No Secrets in Files**: Database credentials come from environment variables
- 🔒 **Least Privilege**: Migration tools use same DB credentials as application
- 🔒 **Audit Trail**: All migrations are logged with timestamps
- 🔒 **Integrity Checks**: File checksums prevent unauthorized modifications

## Migration Examples

### Creating a New Table

**001_create_user_preferences.up.sql**:
```sql
-- Migration: Create user preferences table
-- Version: 001
-- Description: Add table for storing user preferences and settings

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    language VARCHAR(10) DEFAULT 'en',
    notifications JSONB DEFAULT '{"email": true, "push": true}',
    privacy_settings JSONB DEFAULT '{"profile_visible": true}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_theme ON user_preferences(theme);
```

**001_create_user_preferences.down.sql**:
```sql
-- Migration: Drop user preferences table
-- Version: 001 (DOWN)
-- Description: Remove user preferences table and indexes

-- Drop indexes first
DROP INDEX IF EXISTS idx_user_preferences_theme;
DROP INDEX IF EXISTS idx_user_preferences_user_id;

-- Drop table
DROP TABLE IF EXISTS user_preferences;
```

### Adding a Column

**002_add_user_avatar.up.sql**:
```sql
-- Migration: Add avatar URL to users
-- Version: 002
-- Description: Add avatar_url column to users table

ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);

-- Add index for avatar queries
CREATE INDEX idx_users_avatar_url ON users(avatar_url) WHERE avatar_url IS NOT NULL;
```

**002_add_user_avatar.down.sql**:
```sql
-- Migration: Remove avatar URL from users
-- Version: 002 (DOWN)
-- Description: Remove avatar_url column from users table

-- Drop index first
DROP INDEX IF EXISTS idx_users_avatar_url;

-- Remove column
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
```

## Monitoring and Observability

### Migration Metrics

The migration system provides logging and can be integrated with your monitoring:

```go
// Log migration events
[discovery-svc-migrations] Starting migration up for service: discovery-svc
[discovery-svc-migrations] Found 2 pending migrations
[discovery-svc-migrations] Successfully applied migration 001_add_availability_columns
[discovery-svc-migrations] Successfully applied migration 002_add_ranking_config
[discovery-svc-migrations] All migrations completed successfully
```

### Health Checks

Migration status can be included in service health checks:

```go
// In your service health check
func (h *HealthHandler) CheckMigrations() bool {
    status, err := migrationEngine.GetStatus()
    return err == nil && status.Pending == 0
}
```

## FAQ

### Q: Can I run migrations manually instead of automatically?
**A**: Yes, remove the migration execution from `docker-entrypoint.sh` and run them manually:
```bash
docker exec -it service-name ./migrate -action=up
```

### Q: How do I handle migrations that take a long time?
**A**: Use the migration timeout configuration:
```go
config := &migrations.Config{
    MigrationTimeout: 30 * time.Minute,
}
```

### Q: What happens if a migration fails halfway?
**A**: Since migrations run in transactions, partial failures are automatically rolled back. Check the logs and fix the SQL before retrying.

### Q: Can I skip a migration?
**A**: Not recommended. If you need to skip, manually insert a record in `migration_records` table, but this can lead to inconsistencies.

### Q: How do I handle data migrations?
**A**: Create migrations that transform data safely:
```sql
-- Safe data migration with error handling
UPDATE users 
SET status = 'active' 
WHERE status IS NULL AND created_at > NOW() - INTERVAL '30 days';
```

## Support

- **Issues**: Check migration logs and use `verify` action to diagnose problems
- **Documentation**: This guide and inline code comments
- **Examples**: See existing migration files in each service
- **Help**: Run any migration tool with `-help` flag for usage information

---

*This migration system follows the Link project rules for environment parity, version control, and container-based deployments.*
