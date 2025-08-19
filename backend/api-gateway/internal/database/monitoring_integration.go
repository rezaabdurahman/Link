package database

import (
    "os"
    "time"
    
    "gorm.io/driver/postgres"
    "gorm.io/gorm"
    "gorm.io/gorm/logger"
)

// InitDBWithMonitoring initializes database connection with comprehensive monitoring
func InitDBWithMonitoring(serviceName string) (*gorm.DB, error) {
    // Initialize database monitor
    dbMonitor := NewDatabaseMonitor(serviceName)
    
    // Create GORM logger with monitoring
    gormLogger := NewGormLogger(
        dbMonitor,
        logger.Default.LogMode(logger.Info),
    )
    
    // Connect to database
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        dsn = "host=postgres user=link_user password=link_pass dbname=link_app port=5432 sslmode=disable"
    }
    
    db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
        Logger: gormLogger, // This enables automatic monitoring!
    })
    
    if err != nil {
        return nil, err
    }
    
    // Monitor connection pool in background
    sqlDB, err := db.DB()
    if err == nil {
        go func() {
            ticker := time.NewTicker(30 * time.Second)
            defer ticker.Stop()
            
            for {
                select {
                case <-ticker.C:
                    stats := sqlDB.Stats()
                    dbMonitor.UpdateConnectionMetrics("postgres", stats.OpenConnections)
                }
            }
        }()
    }
    
    return db, nil
}

// GetQueryStats returns current query statistics for debugging
func GetQueryStats(dbMonitor *DatabaseMonitor) map[string]*QueryMetrics {
    return dbMonitor.GetQueryStats()
}
