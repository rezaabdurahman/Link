# Ranking Algorithm v1 Implementation

## Overview

This document describes the implementation of the ranking algorithm v1 for the discovery service, as specified in Step 5 of the broader plan.

## Algorithm Formula

```
Score = 0.6 · semantic_similarity + 0.2 · interest_overlap + 0.1 · geo_proximity + 0.1 · recent_activity
```

Where:
- **semantic_similarity**: Cosine similarity from pgvector (0.0 - 1.0)
- **interest_overlap**: Jaccard coefficient over interests (pre-computed bitset) (0.0 - 1.0) 
- **geo_proximity**: Normalized distance within 10 mi radius (0.0 - 1.0)
- **recent_activity**: Inverse of minutes since last heartbeat (0.0 - 1.0)

## Component Details

### 1. Semantic Similarity (Weight: 0.6)
- **Source**: Cosine similarity from pgvector
- **Range**: 0.0 - 1.0
- **Implementation**: Provided by the search service via semantic search
- **Higher**: Better semantic match between query and user profile

### 2. Interest Overlap (Weight: 0.2)
- **Source**: Jaccard coefficient over interests bitset
- **Range**: 0.0 - 1.0
- **Formula**: `|A ∩ B| / |A ∪ B|` where A and B are interest bitsets
- **Implementation**: Bitwise operations on pre-computed interest bitsets
- **Higher**: More shared interests between requester and candidate

### 3. Geographical Proximity (Weight: 0.1)
- **Source**: Haversine distance calculation
- **Range**: 0.0 - 1.0
- **Max Distance**: 10 miles (16.09 km)
- **Formula**: `max(0.0, 1.0 - (distance_km / 16.09))`
- **Higher**: Closer geographical distance

### 4. Recent Activity (Weight: 0.1)
- **Source**: Minutes since last heartbeat (availability update)
- **Range**: 0.0 - 1.0
- **Formula**: `e^(-minutes/60)` with minimum of 0.01
- **Implementation**: Exponential decay with 60-minute half-life
- **Higher**: More recent activity

## Database Schema

### Ranking Configuration Table
```sql
CREATE TABLE ranking_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value DECIMAL(3,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Default Configuration
- `semantic_similarity_weight`: 0.60
- `interest_overlap_weight`: 0.20
- `geo_proximity_weight`: 0.10
- `recent_activity_weight`: 0.10

## API Endpoints

### Get Ranking Information
```http
GET /api/v1/ranking/info
```
Returns detailed information about the ranking algorithm, current weights, and status.

### Get Current Weights
```http
GET /api/v1/ranking/weights
```
Returns the current ranking weights from the database.

### Update Weights (A/B Testing Ready)
```http
PUT /api/v1/ranking/weights
Content-Type: application/json

{
  "semantic_similarity_weight": 0.65,
  "interest_overlap_weight": 0.15,
  "geo_proximity_weight": 0.10,
  "recent_activity_weight": 0.10
}
```

### Reset to Defaults
```http
POST /api/v1/ranking/weights/reset
```

### Validate Weights
```http
GET /api/v1/ranking/weights/validate
```

## Implementation Files

### Core Components
- `internal/models/ranking_config.go` - Data models for ranking configuration
- `internal/repository/ranking_config_repository.go` - Database operations
- `internal/service/ranking_service.go` - Core ranking algorithm logic
- `internal/handlers/ranking_handler.go` - HTTP API handlers

### Database
- `migrations/002_add_ranking_config_up.sql` - Migration to create config table
- `migrations/002_add_ranking_config_down.sql` - Migration rollback

### Integration
- Updated `main.go` to initialize ranking service and routes
- Updated `internal/service/availability_service.go` to support ranking

## Key Features

### 1. Configurable Weights
- Weights stored in database for runtime adjustability
- No redeploy required for A/B testing
- Automatic validation ensures weights sum to ~1.0

### 2. Component Scoring
Each component is calculated independently:
- **Interest Overlap**: Bitwise Jaccard coefficient calculation
- **Geo Proximity**: Haversine distance with linear decay
- **Recent Activity**: Exponential decay function
- **Semantic Similarity**: Pass-through from search service

### 3. Batch Processing
- Efficient batch ranking calculation
- Single database query for weights
- Optimized for multiple user scoring

### 4. A/B Testing Ready
- Runtime weight configuration
- RESTful API for weight management
- Validation and rollback capabilities
- Detailed algorithm information endpoint

## Usage Examples

### Basic Ranking Calculation
```go
// Initialize ranking service
rankingService := service.NewRankingService(configRepo)

// Prepare input
input := &models.RankingInput{
    UserID: candidateID,
    SemanticSimilarity: 0.85,
    InterestBitset: candidateBitset,
    Latitude: &candidateLat,
    Longitude: &candidateLng,
    LastAvailableAt: &lastSeen,
}

// Calculate ranking
result, err := rankingService.CalculateRanking(input, requesterInterests, requesterLocation)
```

### Batch Ranking
```go
// Process multiple candidates efficiently
results, err := rankingService.CalculateBatchRanking(inputs, requesterInterests, requesterLocation)
```

### Weight Management
```go
// Update weights for A/B testing
req := &models.UpdateRankingConfigRequest{
    SemanticSimilarityWeight: &0.65,
    InterestOverlapWeight: &0.15,
}
newWeights, err := rankingService.UpdateWeights(req)
```

## Performance Considerations

### Optimizations
- Single database query for configuration weights
- Bitwise operations for interest overlap calculation
- Batch processing support
- Efficient Haversine distance calculation

### Caching Strategy
- Configuration weights cached during batch operations
- Interest bitsets pre-computed and stored
- Geographic calculations optimized with early exit for distant users

## Monitoring and Debugging

### Validation
- Automatic weight validation (must sum to ~1.0)
- Input validation for all components
- Error handling with graceful degradation

### Debugging Endpoints
- `/api/v1/ranking/config` - Raw configuration data
- `/api/v1/ranking/weights/validate` - Weight validation status
- Detailed ranking breakdowns in responses

## Future Enhancements

### Potential Improvements
1. **Machine Learning Integration**: Replace manual weights with learned weights
2. **User Feedback**: Incorporate click-through rates and user interactions
3. **Time-based Patterns**: Account for user activity patterns and timezone preferences
4. **Advanced Geo Features**: Consider location type (work, home, etc.)
5. **Dynamic Interest Scoring**: Weight interests by recency and engagement

### A/B Testing Scenarios
- Test different weight distributions
- Evaluate component importance
- Measure ranking quality metrics
- User engagement and satisfaction studies

## Conclusion

The ranking algorithm v1 provides a solid foundation for user discovery with:
- Configurable, database-stored weights for A/B testing
- Four complementary ranking components
- Efficient implementation with batch processing support
- Comprehensive API for management and monitoring
- Ready for production deployment and experimentation
