# Claude Context for Link Project

## Project Overview
A modern social discovery platform that helps people connect with others in person and deepen their relationships through AI-powered features and location-based discovery.

## Current Architecture Status
**Production-Ready Microservices Architecture:**
- **Frontend**: React 18 + TypeScript + Tailwind CSS (iOS-style UI) ✅ **DEPLOYED**
- **API Gateway**: Central entry point with JWT auth, service routing, rate limiting ✅ **DEPLOYED**
- **Backend Services**: All Go microservices fully implemented and deployed:
  - `user-svc` - User management, authentication, friends system ✅
  - `chat-svc` - Real-time messaging with WebSocket support ✅
  - `ai-svc` - AI conversation summarization (OpenAI integration) ✅
  - `discovery-svc` - User discovery with availability tracking ✅
  - `search-svc` - Search functionality with vector embeddings ✅
  - `feature-svc` - Dynamic feature flag and A/B testing system ✅
- **Databases**: PostgreSQL with per-service isolation, Redis for caching/sessions ✅
- **Security**: mTLS service mesh (Linkerd), database isolation, JWT auth ✅
- **Infrastructure**: Docker Compose (dev), Kubernetes + ArgoCD (prod), comprehensive monitoring ✅
- **Observability**: Prometheus + Grafana + Loki + Jaeger stack ✅

## Development Commands

### Quick Start (Recommended)
- **Full stack setup**: `./scripts/dev-workflow.sh setup` (one-time setup)
- **Start all services**: `./scripts/dev-workflow.sh start`
- **Start individual service**: `./scripts/dev-workflow.sh start user-svc` (available: user-svc, api-gateway, chat-svc, discovery-svc, ai-svc, search-svc, feature-svc)
- **Frontend development**: `npm run dev` (from root)

### Feature Flag Management
- **List all flags**: `./scripts/feature-admin.sh list_flags`
- **Create new flag**: `./scripts/feature-admin.sh create_flag <key> <name> <description> <type>`
- **Toggle flag**: `./scripts/feature-admin.sh toggle_flag <key> <environment>`
- **View flag history**: `./scripts/feature-admin.sh flag_history <key> <limit>`

### Root Level Commands
- **Start backend services**: `cd backend && docker-compose up -d`
- **Start frontend**: `npm run dev`
- **Build frontend**: `npm run build`
- **Run all tests**: `npm run test`
- **Lint all code**: `npm run lint`
- **Type check**: `npm run type-check`
- **Security scan**: `./scripts/test-security-setup.sh`
- **Feature flag management**: `./scripts/feature-admin.sh [command]`

### Feature Flag Administration
- **List all flags**: `./scripts/feature-admin.sh list_flags`
- **Get flag details**: `./scripts/feature-admin.sh get_flag [flag_key]`
- **Toggle flag**: `./scripts/feature-admin.sh toggle_flag [flag_key] [environment]`
- **Enable with rollout**: `./scripts/feature-admin.sh enable_flag [flag_key] [env] [percentage] "[reason]"`
- **View recent changes**: `./scripts/feature-admin.sh recent_changes [limit]`
- **Flag history**: `./scripts/feature-admin.sh flag_history [flag_key] [limit]`

### Frontend (cd frontend/)
- **Dev server**: `npm run dev`
- **Build**: `npm run build` or `npm run build:production`
- **Test**: `npm run test` or `npm run test:coverage`
- **Lint**: `npm run lint` or `npm run lint:fix`
- **Type check**: `npm run type-check`

### Backend Services (cd backend/[service]/)
- **Build**: `make build`
- **Run**: `make run`
- **Test**: `make test` or `make test-coverage`
- **Lint**: `make lint`
- **Format**: `make format`
- **Migrate**: `make migrate-up`
- **Dev with hot reload**: `make dev` (requires air)

### Production Operations
- **Deploy to Kubernetes**: `kubectl apply -f k8s/argocd/root-app.yaml`
- **Validate deployment**: `./scripts/validate-k8s-deployment.sh`
- **Security testing**: `./scripts/test-security-boundaries.sh`
- **Database monitoring**: `./scripts/test-database-monitoring.sh`
- **Performance testing**: `./scripts/enhanced_performance_test.sh`

### Build & Cache Management
- **Cached development**: `make -f Makefile.cache dev-cached`
- **Cache info**: `make -f Makefile.cache cache-info`
- **Clean cache**: `make -f Makefile.cache cache-clean`
- **Audit Dockerfiles**: `./scripts/optimize-dockerfiles.sh`
- **Build performance**: `./scripts/measure-build-performance.sh [service]`

## Coding Conventions
- **TypeScript**: Strict mode enabled, proper type annotations required
- **ESLint**: Follow configured rules, max 300 warnings for legacy code
- **Go**: Follow standard Go conventions, use golangci-lint
- **Testing**: Maintain ≥60% code coverage for critical paths
- **Components**: Follow design system, use same variants within pages
- **File naming**: camelCase for JS/TS, snake_case for Go
- **API**: RESTful design, consistent error responses
- **Database**: Use migrations, no manual schema changes

## Feature Flag Management

### Dynamic Feature Flag System
The platform uses a sophisticated feature flag system for gradual rollouts, A/B testing, and environment-specific configurations:

- **CLI-Only Administration**: All feature flag operations use secure CLI tools, not web interfaces
- **Environment Isolation**: Separate configurations for development, staging, and production
- **A/B Testing**: Built-in experiment framework with variant assignment and tracking
- **User Segmentation**: Target specific user groups based on attributes
- **Audit Logging**: Complete change history with user attribution and reasons

### Feature Flag Administration

```bash
# Administrative wrapper script (recommended)
./scripts/feature-admin.sh list_flags                    # View all flags
./scripts/feature-admin.sh get_flag my_flag              # Get flag details
./scripts/feature-admin.sh toggle_flag my_flag production # Toggle flag
./scripts/feature-admin.sh enable_flag my_flag production 25 "Gradual rollout"

# Direct CLI tool (advanced)
cd backend/feature-svc
make -f Makefile.cli build-cli
./bin/feature-cli flag create new_feature --type=boolean
./bin/feature-cli flag rollout new_feature 50 --env=production
```

### Frontend Integration

```tsx
import { useFeatureFlag, FeatureGate, SimpleABTest } from '../hooks/useFeatureFlag';

// Simple feature flag check
const isDarkModeEnabled = useFeatureFlag('dark_mode');

// Component-based gating
<FeatureGate flagKey="new_chat_ui">
  <NewChatInterface />
</FeatureGate>

// A/B testing
<SimpleABTest
  experimentKey="onboarding_flow_test"
  control={<StandardOnboarding />}
  treatment={<SimplifiedOnboarding />}
/>
```

### Key Features
- **Security**: Database-level access required, no web admin interface
- **Performance**: Redis caching with 5-minute default TTL
- **Monitoring**: Prometheus metrics and Grafana dashboards
- **Migration Support**: Backward compatibility with legacy static flags

**Documentation**: See `docs/FEATURE_FLAGS_SETUP_GUIDE.md` for comprehensive setup and usage guide.

## Important Files & Directories

### Root
- `CLAUDE.md` - This context file (you are here)
- `README.md` - Main project documentation
- `CHANGELOG.md` - Version history and release notes
- `Project Vision.md` - High-level product vision
- `package.json` - Root package file with frontend scripts
- `docker-compose.yml` - Local development services

### Scripts (`scripts/`)
- `feature-admin.sh` - CLI wrapper for feature flag administration
- `dev-workflow.sh` - Enhanced development workflow automation
- `test-security-boundaries.sh` - Service isolation security testing

### Documentation (`docs/`) - **NEWLY ORGANIZED** ✨
- `README.md` - Documentation index with role-based navigation
- `FEATURE_FLAGS_SETUP_GUIDE.md` - Comprehensive feature flag and A/B testing guide
- `deployment/` - Comprehensive deployment guides (Docker Compose, Kubernetes, CI/CD)
- `security/` - Security architecture, authentication, testing procedures
- `observability/` - Monitoring, logging, alerting, dashboards
- `architecture/adr/` - Architecture Decision Records (moved from root)
- `api/services/` - Per-service API documentation
- `operations/` - Troubleshooting, database ops, backup procedures

### Frontend (`frontend/`) - **PRODUCTION READY** ✅
- `src/components/` - Reusable React components with iOS design system
- `src/pages/` - Feature pages (Discovery, Chat, Profile, Opportunities)
- `src/services/` - API client services with error handling
- `src/contexts/` - React contexts (Auth, Feature Flags, etc.)
- `src/types/` - TypeScript type definitions
- `src/hooks/` - Custom React hooks including `useFeatureFlag` for dynamic flags
- `src/stores/` - Zustand state management

### Backend (`backend/`) - **ALL SERVICES DEPLOYED** ✅
- `api-gateway/` - Central entry point, JWT auth, service routing
- `user-svc/` - User management, authentication, friends, RBAC
- `chat-svc/` - Real-time messaging, WebSocket support
- `ai-svc/` - AI conversation summarization (OpenAI integration)
- `discovery-svc/` - User discovery, availability tracking, matching
- `search-svc/` - Search with vector embeddings (Qdrant)
- `feature-svc/` - Dynamic feature flags and A/B testing system
- `shared-libs/` - Common Go libraries, metrics, tracing, feature evaluation
- `docker-compose.yml` - Local development orchestration

### Infrastructure - **PRODUCTION GRADE** ✅
- `k8s/` - Kubernetes manifests, ArgoCD apps, Linkerd service mesh
- `monitoring/` - Prometheus, Grafana, Loki, AlertManager stack
- `terraform/` - Infrastructure as Code with AWS integration
- `scripts/` - Deployment automation, security testing, performance

### Security & Operations
- `security_tests.sh` - Comprehensive security test suite
- `scripts/test-security-boundaries.sh` - Service isolation testing
- `reports/` - Security scan results and compliance reports

## Development Rules & Preferences

### 🚨 **CRITICAL RULES** - Always Follow
1. **Git Workflow**: Never merge to local main. Work on feature branches → push to remote → create PR to merge with remote main
2. **Security First**: Never commit secrets, API keys, or sensitive data. All secrets via environment variables and External Secrets Operator
3. **Architecture Alignment**: For new features, align architecture, API design, and data models BEFORE coding
4. **Testing Requirements**: Write tests for all new features. Maintain ≥60% code coverage for critical paths
5. **Production Parity**: Use containerization for consistent dev/staging/production environments

### 🏗️ **Architecture & Design**
6. **Infrastructure as Code**: Use Terraform/Kubernetes. Never make manual production changes. Avoid one-off scripts
7. **Design System Consistency**: All components must follow the iOS design system. Same variants within pages
8. **Service Boundaries**: Respect microservice boundaries. Use proper service-to-service authentication
9. **Database Isolation**: Each service has its own database. Use migrations for schema changes
10. **API Design**: RESTful APIs with consistent error responses. Document all public APIs

### 🔧 **Code Quality**
11. **TypeScript Strict**: Use strict mode, proper type annotations. Run type checking before commits
12. **Code Organization**: Clear separation of concerns. Dedicated directories for source, tests, docs, config
13. **Dependency Management**: Use exact versions in production. Regular security audits and updates
14. **Conventional Commits**: Use conventional commit format (feat:, fix:, docs:, etc.)
15. **Documentation**: Keep docs current. Use `docs/` structure for all documentation

### 🛡️ **Security & Operations**
16. **mTLS Required**: All service-to-service communication via Linkerd service mesh
17. **JWT Validation**: Validate JWTs at API Gateway. Propagate user context via headers
18. **Database Security**: SSL connections, unique credentials per service, connection pooling
19. **Monitoring**: All services must expose /metrics and /health endpoints
20. **Security Testing**: Run security test suite before production deployments
21. **Feature Flag Management**: Use CLI-only administration for security. All production flag changes require documented reasons

## Current Project Status

### ✅ **COMPLETED & DEPLOYED**
- **All 6 microservices** implemented and production-ready (stories-svc removed, feature-svc added)
- **Dynamic feature flag system** with CLI administration, A/B testing, and user segmentation
- **Frontend application** with full feature set (Discovery, Chat, Profile, Opportunities)
- **Security architecture** with mTLS, database isolation, JWT auth
- **Observability stack** with metrics, logging, tracing, alerting
- **Production infrastructure** with Kubernetes, ArgoCD, Terraform
- **Documentation overhaul** - organized from 100+ scattered files to structured docs/

### 🔄 **ONGOING OPERATIONS**
- **Feature Flag Management**: CLI-based administration, gradual rollouts, A/B testing
- **Monitoring & Alerting**: Prometheus metrics, Grafana dashboards, alert rules
- **Security Compliance**: Regular security scans, penetration testing
- **Performance Optimization**: Database query optimization, caching strategies
- **Feature Development**: New social features, AI enhancements

### 📊 **KEY METRICS & HEALTH**
- **Service Availability**: >99.9% uptime target
- **Response Times**: <200ms p95 for API endpoints
- **Security Posture**: Zero critical vulnerabilities
- **Code Coverage**: >60% for critical paths
- **Documentation**: Fully organized and current

### 🎯 **FOCUS AREAS FOR NEW DEVELOPMENT**
1. **Feature Experimentation**: A/B testing, user segmentation, conversion tracking
2. **Performance**: Database optimization, caching improvements
3. **Features**: Enhanced AI capabilities, social features
4. **Mobile**: iOS/Android native app development
5. **Analytics**: User behavior tracking, engagement metrics
6. **Scaling**: Auto-scaling policies, load testing

## Notes for Claude
- **Documentation**: Use the `docs/` structure. All major topics are covered including `docs/FEATURE_FLAGS_SETUP_GUIDE.md`
- **Development**: Use `./scripts/dev-workflow.sh` for local development
- **Feature Flags**: Use `./scripts/feature-admin.sh` for CLI-based flag management (security-first approach)
- **Deployment**: Use ArgoCD for production deployments
- **Security**: Run security tests before any production changes. Feature flag admin is CLI-only for security
- **Architecture**: The platform is mature - focus on optimization, new features, and A/B testing
- **Code Quality**: Maintain high standards - this is production code with real users
- **Migration**: Legacy static feature flags are being migrated to dynamic system using `FEATURE_FLAG_MIGRATION` mapping
