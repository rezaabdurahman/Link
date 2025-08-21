# Claude Context for Link Project

## Project Overview
A social app that helps people connect with others in person and deepen their connections

## Architecture
Microservices architecture with:
- **Frontend**: React 18 + TypeScript + Tailwind CSS (iOS-style UI)
- **API Gateway**: Central entry point with JWT auth and request routing
- **Backend Services**: Go microservices (user-svc, chat-svc, ai-svc, discovery-svc, search-svc)
- **Databases**: PostgreSQL for each service + Redis for caching/sessions
- **Infrastructure**: Docker Compose, Linkerd service mesh, monitoring stack

## Development Commands
### Root Level
- **Start backend**: `cd backend && docker-compose up -d`
- **Start frontend**: `npm run dev` (runs cd frontend && npm run dev)
- **Build frontend**: `npm run build`
- **Lint**: `npm run lint`
- **Type check**: `npm run type-check`
- **Test**: `npm run test`

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

## Coding Conventions
- **TypeScript**: Strict mode enabled, proper type annotations required
- **ESLint**: Follow configured rules, max 300 warnings for legacy code
- **Go**: Follow standard Go conventions, use golangci-lint
- **Testing**: Maintain ≥60% code coverage for critical paths
- **Components**: Follow design system, use same variants within pages
- **File naming**: camelCase for JS/TS, snake_case for Go
- **API**: RESTful design, consistent error responses
- **Database**: Use migrations, no manual schema changes

## Important Files & Directories
### Root
- `CLAUDE.md` - This context file
- `package.json` - Root package file with frontend scripts
- `docker-compose.yml` - Main backend services
- `README.md` - Comprehensive project documentation

### Frontend (`frontend/`)
- `src/components/` - Reusable React components
- `src/pages/` - Page components (Discovery, Chat, Profile, etc.)
- `src/services/` - API client services
- `src/contexts/` - React contexts (Auth, etc.)
- `src/types/` - TypeScript type definitions
- `package.json` - Frontend dependencies and scripts

### Backend (`backend/`)
- `api-gateway/` - Central entry point, JWT auth, request routing
- `user-svc/` - User management, authentication, friends
- `chat-svc/` - Real-time messaging, WebSocket support
- `ai-svc/` - AI conversation summarization (OpenAI)
- `discovery-svc/` - User discovery, availability tracking
- `search-svc/` - Search functionality with embeddings
- `shared-libs/` - Common Go libraries
- `docker-compose.yml` - Backend services orchestration

### Infrastructure
- `k8s/` - Kubernetes manifests, Linkerd config
- `monitoring/` - Prometheus, Grafana, alerting
- `terraform/` - Infrastructure as code
- `scripts/` - Deployment and setup scripts

## Rules & Preferences
<!-- Add any specific rules or preferences you want me to follow -->
1. Never merge to local main branch, only use it for fetching & rebasing. Work of a different branch,  push to remote feature branch, then create a pull request to merge with remote main
2. All components must follow the design system for visual consistency. Within a single page, similar components must use the same variant
3. For new feature requests, align overall architecture, api, and data model , before proceeding with code execution
4. Write tests for all new features and bug fixes. Maintain at least 60% code coverage for critical paths.
5. Maintain development, staging, and production environment parity. Use containerization (Docker) for consistent environments.
6. Always use version-controlled infrastructure definitions (Terraform, Ansible). Never make manual changes to production infrastructure.
7. Always use exact versions for production dependencies. Regularly audit and update dependencies for security vulnerabilities.
8. Never commit secrets, API keys, or sensitive data. Use environment variables and .env files (added to .gitignore) for configuration.
9. Always include a comprehensive README.md with setup instructions, usage examples, and contribution guidelines. Document all public APIs.
10. Use TypeScript strict mode, proper type annotations, and follow ESLint rules. Always run type checking before commits.
11. Always commit changes with descriptive messages following conventional commit format (feat:, fix:, docs:, etc.). Never commit directly to main/master branch for features.
12. Always organize code with clear separation of concerns - separate directories for source code, tests, documentation, and configuration files.

## Notes
<!-- Any other context that would be helpful -->
