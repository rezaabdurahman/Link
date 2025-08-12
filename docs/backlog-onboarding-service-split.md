# Backlog Ticket: Revisit Onboarding Service Split

## Issue ID
`BACKLOG-001`

## Priority
Medium (to be elevated based on triggers below)

## Title
Split Onboarding Functionality into Dedicated Microservice

## Description
Currently, the onboarding functionality is implemented within the user-svc microservice using a dedicated `internal/onboarding` package. As the platform scales, we should consider extracting this into a separate onboarding microservice for better separation of concerns and scalability.

## Background
During MVP development, we made the pragmatic decision to keep onboarding within user-svc to:
- Accelerate time-to-market
- Avoid premature microservice proliferation
- Share the same database (users table)

The current implementation:
- ✅ Uses dedicated `internal/onboarding` package
- ✅ Exposes endpoints under `/api/v1/onboarding/...`
- ✅ Emits domain events (`UserOnboarded`) via event bus
- ✅ Maintains clean architectural boundaries

## Triggers for Re-evaluation
This ticket should be **prioritized when ANY of the following conditions are met**:

### User Volume Threshold
- [ ] **User volume ≥ 100,000 registered users**
- [ ] **Daily active onboarding sessions > 1,000**

### Performance Requirements
- [ ] **Profile analytics requires heavy compute** (machine learning, advanced analytics)
- [ ] **Onboarding completion analytics need real-time processing**
- [ ] **A/B testing framework needs dedicated resources**

### Operational Complexity
- [ ] **Different deployment schedules** needed for onboarding vs user features
- [ ] **Different team ownership** required
- [ ] **Different scaling requirements** between user management and onboarding

### Technical Requirements
- [ ] **Complex onboarding workflows** requiring workflow engines
- [ ] **Integration with external services** (CRM, marketing tools, analytics platforms)
- [ ] **Specialized data storage needs** (time-series data, analytics databases)

## Proposed Split Architecture

When triggered, extract onboarding into a dedicated service:

```
onboarding-svc/
├── api/
│   └── v1/onboarding/        # Same endpoints, different service
├── internal/
│   ├── domain/               # Core onboarding logic
│   ├── analytics/            # Onboarding analytics
│   ├── workflows/            # Complex onboarding flows
│   └── integrations/         # External service integrations
└── database/                 # Dedicated onboarding database
```

### Migration Strategy
1. **Database Migration**: Extract onboarding tables to dedicated DB
2. **API Contract**: Maintain same API contracts during transition
3. **Event Integration**: Continue publishing `UserOnboarded` events
4. **Service Communication**: Use gRPC/HTTP for user data queries
5. **Gradual Migration**: Feature-flag based rollout

### Benefits of Split
- **Independent Scaling**: Scale onboarding separately from user management
- **Team Ownership**: Dedicated onboarding team can own the entire workflow
- **Technology Flexibility**: Use specialized tools for analytics and workflows
- **Deployment Independence**: Deploy onboarding features without user-svc impact
- **Database Optimization**: Optimize database for onboarding-specific queries

## Acceptance Criteria
When implementing the split:

- [ ] Maintain API compatibility (`/api/v1/onboarding/...`)
- [ ] Preserve domain event publishing (`UserOnboarded`)
- [ ] Ensure zero data loss during migration
- [ ] Maintain response time SLAs
- [ ] Update documentation and architecture diagrams
- [ ] Implement service-to-service authentication
- [ ] Set up monitoring and observability
- [ ] Create rollback plan

## Estimated Effort
- **Analysis & Design**: 1-2 weeks
- **Database Migration**: 2-3 weeks  
- **Service Implementation**: 3-4 weeks
- **Testing & Deployment**: 2-3 weeks
- **Total**: ~8-12 weeks (depending on complexity)

## Dependencies
- Service mesh / API gateway configuration
- Database migration tools
- CI/CD pipeline updates
- Monitoring and observability stack

## Review Schedule
- **Quarterly Review**: Check against trigger conditions
- **Annual Architecture Review**: Evaluate overall microservice strategy
- **Post-Incident**: If onboarding-related incidents impact user-svc

## Notes
- Current implementation is well-architected for future extraction
- Domain events provide loose coupling for transition
- Event bus abstraction allows easy swapping of message brokers
- API design already follows microservice patterns

---

**Created**: 2025-01-12  
**Last Updated**: 2025-01-12  
**Status**: Backlog  
**Assignee**: TBD  
**Epic**: Platform Architecture  
**Labels**: microservices, architecture, onboarding, scalability
