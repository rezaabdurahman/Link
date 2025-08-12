# ADR-001: Domain Boundaries - Authentication vs. Profile/Onboarding Contexts

## Status
**PROPOSED** - Awaiting stakeholder review and implementation planning

## Context

The current `user-svc` service handles a wide range of user-related functionality, from core authentication to profile management and social features. As we expand the platform with new onboarding capabilities focused on profile enrichment, we need to clearly define domain boundaries to maintain system integrity and enable future scaling.

This ADR documents the analysis of the current `user-svc` capabilities and proposes logical domain separation for the Authentication and Profile/Onboarding contexts.

## Current State Analysis

### Existing Capabilities in `user-svc`

Based on the codebase analysis, `user-svc` currently handles:

#### Authentication & Session Management
- **User Registration** (`RegisterUser`) - account creation with credential validation
- **User Login** (`LoginUser`) - credential verification and token issuance
- **Token Management** - JWT generation, validation, and refresh
- **Session Tracking** - active session management with expiration
- **Password Security** - hashing, verification, and rehashing for security updates
- **Logout** - session invalidation and token cleanup

#### Profile Management (Basic)
- **Profile CRUD** - creation, reading, updating of user profiles
- **Profile Data** - name, bio, profile picture, location, date of birth
- **Profile Visibility** - public vs. private profile views
- **Email Verification** - account validation status

#### Social Features (Friendship System)
- **Friend Requests** - sending, receiving, accepting/declining requests
- **Friendship Management** - creating and maintaining friendship relationships
- **Friend Discovery** - searching users, viewing public profiles
- **Social Context** - mutual friends calculation, friend status tracking

#### Data Models
- `User` - core user entity with authentication and profile fields
- `Session` - active login tracking
- `Friendship` - bidirectional friend relationships
- `FriendRequest` - pending friendship requests with status management

### Proposed New Onboarding Capabilities

Based on the Project Vision document and frontend types analysis, the following new onboarding capabilities are planned:

#### Enhanced Profile Enrichment
- **Interest Management** - selecting and categorizing user interests for matching
- **Photo Gallery** - multiple profile photos beyond single profile picture
- **Rich Media Support** - profile videos, thumbnails, and media management
- **Onboarding Completion Tracking** - step-by-step profile completion status
- **Profile Optimization** - AI-powered profile enhancement suggestions

#### Discovery & Matching Features
- **Proximity-Based Discovery** - location-aware friend suggestions
- **Interest-Based Matching** - algorithm for compatible friend recommendations
- **Availability Status** - opt-in discoverability controls
- **Connection Prioritization** - "want to get closer" relationship management

## Decision

We propose separating the current monolithic `user-svc` into two distinct logical contexts:

### 1. **Authentication Context** (Core Security Domain)

**Scope**: Secure identity management and access control
- User account lifecycle (registration, activation, deactivation)
- Credential management (password handling, multi-factor auth)
- Session management (login, logout, token lifecycle)
- Authentication token services (JWT generation, validation, refresh)
- Security policies (rate limiting, brute force protection)
- Account recovery and email verification

**Key Characteristics**:
- **High security requirements** - OWASP compliance, audit trails
- **Low change frequency** - stable, well-tested authentication flows
- **Strict data handling** - PII protection, encryption at rest/transit
- **Cross-service dependency** - all services depend on auth

### 2. **Profile/Onboarding Context** (User Experience Domain)

**Scope**: User profile enrichment and social discovery features
- Profile content management (bio, interests, media)
- Onboarding workflow orchestration (step completion, progress tracking)
- Social features (friendships, friend requests, discovery)
- Interest and preference management
- Profile optimization and AI-powered enhancements
- Social graph management (connections, mutual friends)

**Key Characteristics**:
- **High feature velocity** - frequent updates to improve user experience
- **Rich data models** - complex profile attributes and relationships
- **Algorithm-driven** - recommendation engines, matching algorithms
- **User-facing** - direct impact on user satisfaction and engagement

## Domain Boundary Definition

### Clear Separation Principles

#### Authentication Context Owns:
- `User.id`, `User.email`, `User.password_hash`
- `User.email_verified`, `User.is_active`, `User.last_login_at`
- `User.created_at`, `User.updated_at` (for audit purposes)
- `Session` entity and session management
- Token generation and validation
- Password policies and security measures

#### Profile/Onboarding Context Owns:
- `User.username`, `User.first_name`, `User.last_name`
- `User.date_of_birth`, `User.profile_picture`, `User.bio`, `User.location`
- New fields: `interests[]`, `photos[]`, `onboarding_completed`, `availability_status`
- `Friendship` and `FriendRequest` entities
- Social discovery and matching algorithms
- Profile completion tracking and optimization

### Cross-Context Interactions

#### Authentication → Profile/Onboarding
- User creation events (when new account is registered)
- User activation/deactivation events
- User identity verification events

#### Profile/Onboarding → Authentication  
- Profile completion events (may affect authentication requirements)
- Account deletion requests (must trigger auth cleanup)

## Implementation Strategy

### Phase 1: Logical Separation (Current Sprint)
1. **Document domain boundaries** (this ADR)
2. **Identify shared vs. context-specific models**
3. **Define service interfaces** for cross-context communication
4. **Plan data migration strategy** for new onboarding fields

### Phase 2: Service Extraction (Future Sprint)
1. **Extract Authentication Service** - pure identity and access management
2. **Create Profile/Onboarding Service** - user experience and social features
3. **Implement event-driven communication** between contexts
4. **Add new onboarding capabilities** to the Profile service

### Phase 3: Enhancement (Future)
1. **Add AI-powered profile optimization**
2. **Implement advanced matching algorithms**
3. **Build real-time social discovery features**

## Consequences

### Positive
- **Clear domain ownership** - teams can work independently on auth vs. profile features
- **Improved security posture** - authentication code isolated from frequent profile changes
- **Better scalability** - profile/social features can scale independently from auth
- **Faster feature development** - profile enhancements don't require auth system changes
- **Reduced deployment risk** - auth stability not affected by profile experiments

### Negative
- **Increased complexity** - need to manage inter-service communication
- **Data consistency challenges** - distributed data across multiple services
- **Development overhead** - more complex local development setup
- **Monitoring complexity** - distributed tracing across service boundaries

### Mitigations
- **Event-driven architecture** - eventual consistency with event sourcing
- **Shared user ID** - common identifier for cross-service data correlation
- **API gateway** - centralized request routing and authentication
- **Comprehensive testing** - end-to-end tests covering multi-service flows

## Deployment Options Analysis

Based on the domain boundary analysis above, we evaluated two primary deployment strategies for implementing the Authentication and Profile/Onboarding contexts:

### Option A: Monolith-with-Modules (Single Service)
**Architecture**: Keep both contexts within the same `user-svc` deployment, organized as logical modules

**Pros**:
- Simplest deployment and infrastructure management
- Shared database transactions ensure ACID consistency
- No network hops between contexts - direct function calls
- Single CI/CD pipeline and deployment process
- Simplified monitoring and logging (single service)
- Lower operational overhead

**Cons**:
- Larger codebase in single repository
- Tighter coupling between authentication and profile logic
- Single point of failure affects both contexts
- Cannot scale contexts independently
- Higher risk deployments (entire service affected by any change)
- Potential for feature creep across domain boundaries

### Option B: Dedicated Microservice (Service Split)
**Architecture**: Split into separate `auth-svc` and `profile-onboarding-svc` services

**Pros**:
- Clear separation of concerns and domain boundaries
- Independent scaling based on different load patterns
- Smaller, focused codebases per service
- Independent deployment cycles and reduced blast radius
- Technology diversity (different languages/frameworks per service if needed)
- Better fault isolation

**Cons**:
- Additional infrastructure complexity (service discovery, load balancing)
- Network latency for inter-service communication
- Eventual consistency challenges for cross-context data
- More complex CI/CD pipelines (multiple services)
- Distributed tracing and monitoring overhead
- Potential for data duplication across services

### Deployment Comparison Matrix

| **Aspect** | **Option A: Monolith-with-Modules** | **Option B: Dedicated Microservice** | **Winner** |
|------------|-----------------------------------|-----------------------------------|------------|
| **Development Complexity** | | | |
| Initial Setup | ✅ Simple - single codebase | ❌ Complex - multiple repos, service mesh | **Option A** |
| Local Development | ✅ Single service to run | ❌ Multiple services, docker-compose needed | **Option A** |
| Debugging | ✅ Single process debugging | ❌ Distributed debugging, correlation IDs | **Option A** |
| Testing | ✅ Unit tests, single integration suite | ❌ Unit + integration + contract testing | **Option A** |
| **Operational Complexity** | | | |
| Deployment | ✅ Single deployment artifact | ❌ Coordinated deployments, versioning | **Option A** |
| Monitoring | ✅ Single service metrics | ❌ Distributed tracing, multiple dashboards | **Option A** |
| Infrastructure | ✅ Single container/server | ❌ Load balancers, service discovery, API gateway | **Option A** |
| **Performance** | | | |
| Latency | ✅ In-process calls (~μs) | ❌ Network calls (~ms), serialization overhead | **Option A** |
| Throughput | ⚠️ Shared resources | ✅ Independent scaling per service | **Option B** |
| Resource Usage | ⚠️ Single memory/CPU pool | ✅ Optimized per service characteristics | **Option B** |
| Database | ✅ Single connection pool, transactions | ❌ Connection per service, eventual consistency | **Option A** |
| **Team Ownership** | | | |
| Code Ownership | ❌ Shared ownership, potential conflicts | ✅ Clear service boundaries, team autonomy | **Option B** |
| Release Cycles | ❌ Coordinated releases for all features | ✅ Independent release schedules | **Option B** |
| Expertise | ⚠️ Need full-stack knowledge | ✅ Teams can specialize (auth vs UX) | **Option B** |
| Onboarding | ✅ Single codebase to learn | ❌ Multiple services, integration patterns | **Option A** |
| **Security** | | | |
| Attack Surface | ⚠️ Single large surface area | ✅ Isolated blast radius per service | **Option B** |
| Compliance | ✅ Single audit scope | ❌ Multiple services to audit | **Option A** |
| Secrets Management | ✅ Single service secrets | ❌ Distributed secrets, service-to-service auth | **Option A** |
| **Future Roadmap** | | | |
| Feature Velocity | ❌ Profile features blocked by auth stability needs | ✅ Independent development velocity | **Option B** |
| Technology Evolution | ❌ Single tech stack for all contexts | ✅ Best tool per service (AI/ML for profiles) | **Option B** |
| Third-party Integration | ⚠️ All integrations in single service | ✅ Specialized integrations per context | **Option B** |
| Data Model Evolution | ❌ Schema changes affect entire service | ✅ Independent data model evolution | **Option B** |
| Scaling Strategy | ❌ Scale entire service for any bottleneck | ✅ Scale only bottlenecked service | **Option B** |

### Recommendation Score

| **Category** | **Option A Score** | **Option B Score** |
|--------------|--------------------|-----------------|
| Development Complexity | 🟢 **4/4** | 🔴 **1/4** |
| Operational Complexity | 🟢 **4/4** | 🔴 **1/4** |
| Performance | 🟡 **3/4** | 🟡 **3/4** |
| Team Ownership | 🟡 **2/4** | 🟢 **3/4** |
| Security | 🟡 **2/3** | 🟡 **2/3** |
| Future Roadmap | 🔴 **1/5** | 🟢 **5/5** |
| **Total** | **16/24** | **15/24** |

### Strategic Recommendation

**Current State (Phase 1)**: **Option A - Monolith-with-Modules**
- Given the current team size and operational maturity
- Focus on establishing clear domain boundaries within the monolith
- Implement the logical separation documented in this ADR
- Build event-driven patterns for future extraction

**Future State (Phase 2+)**: **Option B - Dedicated Microservice**
- When team grows beyond 8-10 developers
- After establishing operational expertise with containerization and service mesh
- When profile feature velocity becomes critical for business growth
- After implementing comprehensive monitoring and distributed tracing

## Related Decisions
- ADR-002: Event-Driven Communication Between Services (Future)
- ADR-003: User Identity and Profile Data Synchronization (Future)
- ADR-004: Onboarding Flow Architecture (Future)
- ADR-005: Service Extraction Strategy and Timeline (Future)

## References
- Current `user-svc` implementation: `./backend/user-svc/`
- Project Vision document: `./Project Vision.md`
- Frontend types definition: `./frontend/src/types/index.ts`
- API Gateway documentation: `./backend/api-gateway/docs/`

---

**Decision Makers**: Development Team, Product Manager  
**Date**: 2025-01-12  
**Review Date**: 2025-02-01
