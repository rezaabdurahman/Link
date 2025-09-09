# Database Factory

Unified database factory for Link microservices, providing a consistent interface for both GORM and PGX database connections.

## Features

- **Unified Interface**: Single interface for both GORM and PGX connections
- **Automatic Configuration**: Uses shared-libs/config for consistent database configuration
- **Connection Pooling**: Optimized connection pool settings
- **Health Checks**: Built-in health check functionality
- **Environment-aware**: Different log levels for dev/staging/production

## Usage

### Basic Usage with GORM (Default)

```go
import "github.com/link-app/shared-libs/database"

// Use default configuration (GORM)
db, err := database.NewDatabase(nil)
if err != nil {
    log.Fatal("Failed to connect to database:", err)
}
defer db.Close()

// Get GORM instance
gormDB, err := db.GetGORM()
if err != nil {
    log.Fatal("Failed to get GORM instance:", err)
}

// Use GORM normally
var users []User
gormDB.Find(&users)
```

### Using PGX for High Performance

```go
import "github.com/link-app/shared-libs/database"

cfg := database.DefaultConfig()
cfg.Type = database.DatabaseTypePGX

db, err := database.NewDatabase(cfg)
if err != nil {
    log.Fatal("Failed to connect to database:", err)
}
defer db.Close()

// Get PGX pool
pool, err := db.GetPGXPool()
if err != nil {
    log.Fatal("Failed to get PGX pool:", err)
}

// Use PGX directly
rows, err := pool.Query(ctx, "SELECT * FROM users")
```

### Custom Configuration

```go
cfg := &database.Config{
    Host:            "custom-host",
    Port:            "5432",
    User:            "custom-user",
    Password:        "custom-pass",
    DBName:          "custom-db",
    SSLMode:         "require",
    MaxOpenConns:    50,
    MaxIdleConns:    10,
    ConnMaxLifetime: 30 * time.Minute,
    Type:            database.DatabaseTypeGORM,
    LogLevel:        logger.Error,
}

db, err := database.NewDatabase(cfg)
```

## Health Checks

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

if err := db.Health(ctx); err != nil {
    log.Printf("Database health check failed: %v", err)
}
```

## Environment Variables

The factory respects these environment variables via shared-libs/config:

- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_USER` - Database user (default: linkuser)
- `DB_NAME` - Database name (default: linkdb)
- `DB_SSL_MODE` - SSL mode (default: disable)
- `DB_MAX_OPEN_CONNS` - Maximum open connections (default: 100)
- `DB_MAX_IDLE_CONNS` - Maximum idle connections (default: 10)
- `ENVIRONMENT` - Environment for log level (development/staging/production)

Database passwords are automatically retrieved via shared-libs/config's secrets management.

## Migration from Service-Specific Database Code

### From user-svc pattern:
```go
// Old way
db, err := config.ConnectDatabase()

// New way
db, err := database.NewDatabase(nil)
gormDB, _ := db.GetGORM()
```

### From chat-svc pattern:
```go
// Old way
database, err := db.Connect(cfg.Database)

// New way
cfg := database.DefaultConfig()
cfg.Type = database.DatabaseTypePGX
db, err := database.NewDatabase(cfg)
pool, _ := db.GetPGXPool()
```

This provides a consistent database layer across all services while preserving the flexibility to choose GORM or PGX based on service needs.