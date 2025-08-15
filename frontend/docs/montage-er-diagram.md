# Montage Feature - Entity Relationship Diagram

## Database Schema Overview

The montage feature uses a denormalized approach for optimal read performance while maintaining data integrity.

## ER Diagram

```mermaid
erDiagram
    users ||--o{ user_montages : "has"
    user_montages ||--o{ montage_items : "contains"
    checkins ||--o{ montage_items : "referenced_by"
    
    users {
        uuid id PK
        varchar first_name
        varchar last_name
        varchar email
        jsonb interests
        timestamp created_at
        timestamp updated_at
    }
    
    user_montages {
        uuid id PK
        uuid user_id FK
        varchar interest "NULL for general montage"
        timestamp generated_at
        timestamp expires_at "TTL for cache invalidation"
        integer item_count "Denormalized count"
        text generation_metadata "JSON metadata"
    }
    
    montage_items {
        uuid id PK
        uuid montage_id FK
        uuid checkin_id FK "Reference to original checkin"
        varchar widget_type "media, text, location, etc"
        jsonb widget_metadata "Denormalized widget data"
        timestamp created_at "Original checkin timestamp"
        integer position "For consistent ordering"
    }
    
    checkins {
        uuid id PK
        uuid user_id FK
        varchar content_type
        jsonb widgets "Original widget data"
        varchar location
        jsonb tags
        timestamp created_at
        timestamp updated_at
    }
```

## Table Relationships

### Primary Relationships

1. **users → user_montages** (1:N)
   - One user can have multiple montages (general + interest-specific)
   - Cascade delete: When user is deleted, all their montages are deleted

2. **user_montages → montage_items** (1:N)
   - One montage contains multiple items
   - Cascade delete: When montage is deleted, all items are deleted

3. **checkins → montage_items** (1:N)
   - One checkin can appear in multiple montages (general + various interests)
   - No cascade: Montage items are regenerated, not dependent on checkin lifecycle

### Constraints and Indexes

#### user_montages
```sql
-- Unique constraint: one montage per user per interest
UNIQUE(user_id, interest)

-- Indexes for efficient queries
INDEX idx_user_montages_user_id (user_id)
INDEX idx_user_montages_expires (expires_at)
INDEX idx_user_montages_interest (user_id, interest)
```

#### montage_items
```sql
-- Indexes for efficient queries
INDEX idx_montage_items_montage_id (montage_id)
INDEX idx_montage_items_position (montage_id, position)
INDEX idx_montage_items_checkin (checkin_id)
```

## Data Flow Architecture

```mermaid
graph TB
    subgraph "Data Sources"
        A[User Checkins]
        B[User Interests]
        C[User Privacy Settings]
    end
    
    subgraph "Processing Layer"
        D[Batch Job Processor]
        E[Interest Filter]
        F[Content Scorer]
        G[Montage Generator]
    end
    
    subgraph "Storage Layer"
        H[user_montages]
        I[montage_items]
        J[Cache Layer]
    end
    
    subgraph "API Layer"
        K[Montage API]
        L[Pagination Handler]
        M[Permission Checker]
    end
    
    A --> D
    B --> E
    C --> M
    D --> F
    E --> F
    F --> G
    G --> H
    G --> I
    H --> J
    I --> J
    K --> L
    K --> M
    L --> J
    M --> J
```

## Storage Strategy

### Denormalization Benefits

1. **Fast Reads**: Pre-computed montage items for instant API responses
2. **Reduced Joins**: All necessary data stored in montage_items table
3. **Consistent Ordering**: Position field ensures stable sort order
4. **Cache-Friendly**: TTL-based expiration with expires_at timestamp

### Trade-offs

1. **Storage Overhead**: Duplicated widget metadata across tables
2. **Consistency**: Manual synchronization when checkin data changes
3. **Complexity**: Batch job required for data freshness

### Cache Invalidation Strategy

```sql
-- Automatic cleanup of expired montages
DELETE FROM user_montages 
WHERE expires_at < NOW();

-- Cascade delete automatically removes montage_items
-- due to foreign key constraint with ON DELETE CASCADE
```

## Scalability Considerations

### Partitioning Strategy (Future)

```sql
-- Partition user_montages by user_id hash for horizontal scaling
CREATE TABLE user_montages (
    -- ... columns ...
) PARTITION BY HASH (user_id);

-- Create partitions
CREATE TABLE user_montages_p0 PARTITION OF user_montages
    FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE user_montages_p1 PARTITION OF user_montages
    FOR VALUES WITH (modulus 4, remainder 1);
-- ... etc
```

### Read Replicas

- Primary database: Write operations (batch jobs, regeneration)
- Read replicas: API queries, user-facing operations
- Eventually consistent: Acceptable for montage use case

## Data Lifecycle

### Batch Processing Flow

```mermaid
sequenceDiagram
    participant BJ as Batch Job
    participant DB as Database
    participant CS as Checkin Service
    participant MG as Montage Generator
    
    BJ->>DB: Get users needing refresh
    loop For each user
        BJ->>CS: Fetch recent checkins
        BJ->>MG: Generate montage
        MG->>DB: Upsert user_montages
        MG->>DB: Insert new montage_items
        MG->>DB: Delete old montage_items
    end
    BJ->>DB: Cleanup expired montages
```

### API Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Montage API
    participant DB as Database
    participant PC as Permission Checker
    
    C->>API: GET /users/:id/montage?interest=coffee
    API->>PC: Check user permissions
    PC-->>API: Permission granted
    API->>DB: Query montage_items
    DB-->>API: Return paginated results
    API-->>C: MontageResponse with items
```

## Performance Optimization

### Query Patterns

#### Fetch User Montage (Most Common)
```sql
-- Optimized query for API requests
SELECT mi.*, um.generated_at
FROM montage_items mi
JOIN user_montages um ON mi.montage_id = um.id
WHERE um.user_id = $1 
  AND (um.interest = $2 OR um.interest IS NULL AND $2 IS NULL)
  AND um.expires_at > NOW()
ORDER BY mi.position
LIMIT $3 OFFSET $4;
```

#### Check Cache Status
```sql
-- Fast cache validation
SELECT id, expires_at, item_count
FROM user_montages 
WHERE user_id = $1 AND interest = $2
  AND expires_at > NOW();
```

### Database Tuning

1. **Connection Pooling**: Manage database connections efficiently
2. **Query Caching**: Cache frequent query results
3. **Materialized Views**: Pre-compute complex aggregations
4. **Vacuum Strategy**: Regular maintenance for optimal performance

## Security Considerations

### Data Privacy

1. **User Consent**: Montage generation respects privacy settings
2. **Friend Visibility**: Only visible content included in montages
3. **Data Retention**: Automatic cleanup of expired montages
4. **Access Control**: Permission checks on every API request

### SQL Injection Prevention

```sql
-- All queries use parameterized statements
-- Example: Safe query parameter binding
SELECT * FROM montage_items 
WHERE montage_id = $1 AND position >= $2
ORDER BY position LIMIT $3;
```

## Monitoring and Alerting

### Key Metrics

1. **Storage Growth**: Monitor table sizes and partition efficiency
2. **Cache Hit Rate**: Track expires_at vs actual query patterns
3. **Query Performance**: Monitor slow query log
4. **Batch Job Health**: Success rate and processing time

### Database Health Queries

```sql
-- Table size monitoring
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename LIKE 'montage_%';

-- Index usage statistics
SELECT 
    schemaname, 
    tablename, 
    attname, 
    n_distinct, 
    correlation 
FROM pg_stats 
WHERE tablename IN ('user_montages', 'montage_items');
```

## Backup and Recovery

### Backup Strategy

1. **Daily Full Backup**: Complete database backup
2. **Continuous WAL Archive**: Point-in-time recovery capability
3. **Cross-Region Replication**: Disaster recovery preparation

### Recovery Procedures

1. **Data Corruption**: Restore from backup and regenerate montages
2. **Partial Loss**: Use batch job to regenerate missing montages
3. **Schema Changes**: Migration scripts with rollback capability

This ER diagram and documentation provides a comprehensive view of the montage feature's data architecture, ensuring scalable and maintainable storage while optimizing for read performance.
