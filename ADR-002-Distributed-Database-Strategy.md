# ADR-002: Distributed Database Strategy for Multi-Instance Deployment

**Status:** Proposed  
**Date:** 2025-01-19  
**Author:** Architecture Team  
**Deciders:** Development Team, DevOps Team  

## Executive Summary

This ADR evaluates database architecture options for Link's transition to a multi-instance, distributed microservices deployment. The analysis compares the current shared database approach against database-per-service isolation, considering operational overhead, data coupling, scaling implications, and cross-service transaction requirements.

**Recommendation:** Implement **database-per-service within a single PostgreSQL cluster** to achieve service isolation while minimizing operational complexity.

---

## Context

### Current Database Architecture

**Shared Database Pattern:**
- Single PostgreSQL instance (`link_app` database)
- All services (user-svc, chat-svc, ai-svc, discovery-svc, search-svc) connect to the same database
- Shared connection credentials (`link_user` / `link_pass`)
- Services can potentially access each other's tables (no enforcement of boundaries)

### Problem Statement

The current shared database creates several issues for multi-instance deployment:

1. **Connection Pool Exhaustion:** Multiple instances of each service connecting to single database
2. **Data Coupling:** Services can directly access other services' data, creating hidden dependencies  
3. **Scaling Limitations:** Cannot scale database resources per service based on individual needs
4. **Deployment Dependencies:** Schema changes in one service can affect all others
5. **Security Boundaries:** No database-level isolation between service domains

---

## Current Data Analysis

### Service Data Domains

Based on analysis of existing schemas and models:

#### **User Service Domain** 🏢
- **Tables:** `users`, `friendships`, `friend_requests`, `sessions`, `blocks`
- **Ownership:** User identity, authentication, relationships, privacy settings
- **External References:** None (pure user domain)
- **Cross-Service Access:** Other services reference `user_id` but don't need direct table access

#### **Chat Service Domain** 💬  
- **Tables:** `chat_rooms`, `messages`, `room_members`, `message_reads`, `direct_conversations`
- **Ownership:** Chat functionality, messaging, room management
- **External References:** References `user_id` from user service
- **Cross-Service Access:** AI service may need to read messages for summarization

#### **AI Service Domain** 🤖
- **Tables:** `ai_conversations`, `ai_requests`, `ai_responses`, `ai_usage_stats`, `user_consent`, `audit_logs`, `privacy_policy_versions`, `data_anonymization_records`
- **Ownership:** AI processing, privacy/consent management, GDPR compliance
- **External References:** References `user_id` from user service
- **Cross-Service Access:** Needs to read messages from chat service for summarization

#### **Discovery Service Domain** 🔍
- **Tables:** `user_availability` (location-based user discovery)
- **Ownership:** User discovery, availability tracking, location-based features
- **External References:** References `user_id` from user service  
- **Cross-Service Access:** None currently

#### **Search Service Domain** 🔎
- **Tables:** Vector embeddings, search indexes (using pgvector)
- **Ownership:** Semantic search, content indexing, vector operations
- **External References:** May reference various content from other services
- **Cross-Service Access:** Needs to index content from multiple services

---

## Cross-Service Transaction Analysis

### Current Transaction Patterns

1. **User Registration Flow:**
   - User service creates user → Event published → Other services create related records
   - **Pattern:** Event-driven, no direct transactions

2. **Chat Message with AI Summarization:**
   - Chat service saves message → AI service reads messages → AI service processes
   - **Pattern:** Read-after-write, no transactional requirement

3. **User Consent for AI Processing:**
   - AI service updates consent → Must be reflected immediately for all AI operations
   - **Pattern:** Single service, no cross-service transaction needed

4. **Friend Request with Notifications:**  
   - User service creates friend request → Notification service sends notification
   - **Pattern:** Event-driven, eventual consistency acceptable

### Analysis Result
**No hard transactional requirements** across service boundaries. All workflows can be implemented using:
- Event-driven architecture (eventual consistency)
- Saga pattern for complex workflows  
- Compensating transactions for rollbacks

---

## Architecture Options Evaluation

### Option 1: Shared Database (Current)

**Pros:**
- ✅ Simple to operate (single database)  
- ✅ ACID transactions across all data
- ✅ No data synchronization complexity
- ✅ Easy to implement complex queries across domains

**Cons:**
- ❌ **Critical:** Connection pool exhaustion with multiple service instances
- ❌ **Critical:** No service isolation - schema changes affect all services
- ❌ **Critical:** Hidden data coupling between services
- ❌ Cannot scale database resources per service
- ❌ Single point of failure
- ❌ Violates microservices independence principle
- ❌ **Scaling Blocker:** Cannot horizontally scale services independently

**Multi-Instance Impact:** 🔴 **High Risk** - Connection exhaustion likely with 2+ instances per service

---

### Option 2: Database-per-Service (Separate Clusters)

**Pros:**
- ✅ Complete service isolation
- ✅ Independent scaling and optimization per service
- ✅ Technology diversity (could use different databases)
- ✅ Clear service boundaries
- ✅ Independent backup/recovery per service

**Cons:**
- ❌ **High operational overhead:** 6+ database clusters to manage
- ❌ **High cost:** Multiple database instances in cloud
- ❌ Complex backup and monitoring strategies
- ❌ No cross-service queries (requires service APIs)
- ❌ Distributed transaction complexity
- ❌ Data consistency challenges

**Multi-Instance Impact:** 🟢 **Low Risk** - Perfect isolation, high operational cost

---

### Option 3: Database-per-Service (Single Cluster) ⭐ **RECOMMENDED**

**Pros:**
- ✅ **Service isolation:** Each service has own database/schema
- ✅ **Operational simplicity:** Single PostgreSQL cluster to manage
- ✅ **Cost effective:** One database instance with multiple databases
- ✅ **Independent migrations:** Services manage their own schemas
- ✅ **Connection pooling:** Can pool per database
- ✅ **Security boundaries:** Database-level access control
- ✅ **Scaling ready:** Supports multiple service instances without connection issues

**Cons:**
- ⚠️ Services must communicate via APIs (not direct DB access)
- ⚠️ No cross-service transactions (use events/sagas)
- ⚠️ Need connection pooling strategy (PgBouncer)
- ⚠️ Slightly more complex monitoring (per-database metrics)

**Multi-Instance Impact:** 🟢 **Low Risk** - Excellent balance of isolation and simplicity

---

### Option 4: Schema-per-Service (Same Database)

**Pros:**
- ✅ Logical separation of service data
- ✅ Single database to manage
- ✅ Can still do cross-schema queries if needed

**Cons:**
- ❌ **Still shares connection pool** - doesn't solve multi-instance scaling
- ❌ **Weak isolation** - services can still access other schemas
- ❌ Schema conflicts possible
- ❌ Single point of failure
- ❌ **Doesn't solve the core scaling problem**

**Multi-Instance Impact:** 🔴 **High Risk** - Still has connection pool exhaustion issues

---

## Detailed Recommendation Analysis

### Recommended Solution: Database-per-Service (Single Cluster)

#### Implementation Architecture

```
┌─────────────────────────────────────────────────────┐
│                PostgreSQL Cluster                   │
├─────────────────────────────────────────────────────┤
│  Database: link_users        │  Database: link_chat │
│  User: link_users_user       │  User: link_chat_user│
│  Password: [unique]          │  Password: [unique]  │
├──────────────────────────────┼─────────────────────┤
│  Database: link_ai           │  Database: link_discovery │
│  User: link_ai_user          │  User: link_discovery_user │
│  Password: [unique]          │  Password: [unique]      │
├──────────────────────────────┼─────────────────────┤
│  Database: link_search       │                     │
│  User: link_search_user      │                     │
│  Password: [unique]          │                     │
└─────────────────────────────────────────────────────┘
```

#### Connection Pooling Strategy

```
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ User-Svc    │───▶│ PgBouncer       │───▶│ PostgreSQL       │
│ (3 instances)│    │ Pool: link_users│    │ Database:        │
└─────────────┘    └─────────────────┘    │ link_users       │
                                          └──────────────────┘
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Chat-Svc    │───▶│ PgBouncer       │───▶│ PostgreSQL       │
│ (2 instances)│    │ Pool: link_chat │    │ Database:        │
└─────────────┘    └─────────────────┘    │ link_chat        │
                                          └──────────────────┘
```

#### Benefits for Multi-Instance Deployment

1. **Connection Management:**
   - Each service connects to its own database
   - PgBouncer pools connections per database
   - No interference between services
   - Predictable connection consumption

2. **Independent Scaling:**
   - Scale service instances without affecting others
   - Database resources can be allocated based on service needs
   - Clear performance metrics per service domain

3. **Deployment Independence:**
   - Each service manages its own migrations
   - Schema changes don't affect other services
   - Independent deployment and rollback capabilities

4. **Security Boundaries:**
   - Database-level access control
   - Each service has minimal required permissions
   - Audit trail per service domain

---

## Implementation Roadmap

### Phase 1: Infrastructure Setup (Week 1)

1. **Database Creation:**
   ```sql
   CREATE DATABASE link_users;
   CREATE DATABASE link_chat;
   CREATE DATABASE link_ai;
   CREATE DATABASE link_discovery;
   CREATE DATABASE link_search;
   ```

2. **User & Permission Setup:**
   ```sql
   -- Per service users with minimal permissions
   CREATE USER link_users_user WITH PASSWORD 'unique_password';
   GRANT ALL ON DATABASE link_users TO link_users_user;
   ```

3. **PgBouncer Configuration:**
   ```ini
   [databases]
   link_users = host=postgres port=5432 dbname=link_users
   link_chat = host=postgres port=5432 dbname=link_chat
   # ... per database configurations
   ```

### Phase 2: Schema Migration (Week 1-2)

1. **Move existing tables to appropriate databases**
2. **Update service connection configurations**
3. **Verify foreign key constraints are removed/handled via events**

### Phase 3: Service Configuration Updates (Week 2)

1. **Update Docker Compose:**
   ```yaml
   user-svc:
     environment:
       DB_NAME: link_users
       DB_USER: link_users_user
       DB_PASSWORD: ${USERS_DB_PASSWORD}
   ```

2. **Update Kubernetes secrets and configs**
3. **Update monitoring for per-database metrics**

### Phase 4: Testing & Validation (Week 3)

1. **Multi-instance deployment testing**
2. **Connection pool behavior validation**
3. **Performance benchmarking**
4. **Rollback procedure verification**

---

## Operational Considerations

### Connection Pool Configuration

**Per-Service PgBouncer Pools:**
```ini
# Conservative settings for multi-instance deployment
pool_mode = session
default_pool_size = 10
max_client_conn = 100
reserve_pool_size = 2
server_idle_timeout = 600
```

**Expected Connection Usage:**
- User Service (3 instances): 30 max connections
- Chat Service (2 instances): 20 max connections  
- AI Service (2 instances): 20 max connections
- Discovery Service (1 instance): 10 max connections
- Search Service (1 instance): 10 max connections
- **Total:** ~90 connections vs 500+ with shared database

### Monitoring Strategy

1. **Per-Database Metrics:**
   - Connection count per service database
   - Query performance per service
   - Transaction rate per database

2. **Service-Level Metrics:**
   - Database connection pool utilization
   - Query latency per service
   - Failed connection attempts

### Backup Strategy

**Single backup strategy covers all service databases:**
```bash
pg_dumpall --cluster-backup-including-all-service-databases
```
- **Benefit:** Consistent point-in-time backup across all services
- **Simplicity:** One backup job, one restore procedure

---

## Risk Assessment

### Low Risks ✅
- **Operational Complexity:** Single cluster is manageable
- **Connection Management:** PgBouncer handles pooling effectively
- **Service Isolation:** Database boundaries provide good separation

### Medium Risks ⚠️
- **Migration Complexity:** Need careful planning for table moves
- **Event-Driven Dependencies:** Must implement proper event handling for cross-service data needs
- **Monitoring Setup:** Need per-database observability

### High Risks ❌
- **None identified** - This solution addresses the core scaling limitations without excessive complexity

---

## Decision

**APPROVED:** Implement Database-per-Service within Single PostgreSQL Cluster

### Rationale

1. **Solves Multi-Instance Scaling:** Eliminates connection pool exhaustion
2. **Operational Balance:** Provides isolation without excessive operational overhead
3. **Cost Effective:** Single database cluster with logical separation
4. **Clear Service Boundaries:** Forces proper API-based communication
5. **Production Ready:** Standard pattern used by many distributed systems

### Success Metrics

1. **Technical:**
   - Support 3+ instances per service without connection issues
   - Independent service deployments without cross-service impact
   - Database connection count \u003c 100 total across all services

2. **Operational:**
   - Single database cluster management
   - Per-service monitoring and alerting
   - Independent schema migration capabilities

---

## Consequences

### Positive Consequences

1. **Service Independence:** Each service owns its data domain
2. **Horizontal Scaling:** Multiple instances per service supported  
3. **Clear Boundaries:** Enforced separation of concerns
4. **Operational Simplicity:** Single database cluster to manage
5. **Cost Effective:** No need for multiple database clusters

### Negative Consequences

1. **API Dependency:** Services must communicate via APIs rather than direct database access
2. **Event Implementation:** Need robust event-driven architecture for cross-service workflows
3. **Migration Effort:** One-time effort to separate existing shared tables
4. **Monitoring Complexity:** Slightly more complex with per-database metrics

---

## Related ADRs

- ADR-001: Domain Boundaries (Auth vs Profile Onboarding)
- ADR-003: Service Discovery Strategy (TBD)
- ADR-004: Event-Driven Architecture Implementation (TBD)

---

## References

- [Microservices Database Patterns](https://microservices.io/patterns/data/database-per-service.html)
- [Database-per-service vs Shared Database](https://microservices.io/patterns/data/shared-database.html)  
- [PostgreSQL Multi-Database Architecture](https://www.postgresql.org/docs/current/managing-databases.html)
- [PgBouncer Connection Pooling](https://www.pgbouncer.org/)

**Document Version:** 1.0  
**Last Updated:** 2025-01-19  
**Next Review:** 2025-02-19
