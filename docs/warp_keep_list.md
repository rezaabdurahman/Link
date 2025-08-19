# Warp AI Indexing - Essential Files to Keep

This document lists the files and patterns that **must remain indexable** by Warp AI for effective development assistance.

## Source Code (Core Context)
- `src/**` - All source code files
- `packages/**` - Package source code
- `apps/**` - Application source code
- `backend/**/*.go` - Go service implementations
- `frontend/**/*.{ts,tsx,js,jsx,vue}` - Frontend components and logic
- `lib/**` - Shared library code
- `utils/**` - Utility functions
- `types/**` - Type definitions
- `schemas/**` - Data schemas

## Configuration & Infrastructure
- `Dockerfile*` - Container definitions
- `docker-compose*.yml` - Service orchestration
- `*.tf` - Terraform infrastructure
- `*.yaml`, `*.yml` - Kubernetes, CI/CD configs
- `package.json`, `*/package.json` - Project dependencies
- `go.mod`, `*/go.mod` - Go module definitions
- `tsconfig*.json` - TypeScript configuration
- `.eslintrc*` - Code linting rules
- `.prettierrc*` - Code formatting rules
- `vite.config.*` - Build tool configuration
- `webpack.config.*` - Bundle configuration
- `jest.config.*` - Testing configuration
- `cypress.config.*` - E2E testing
- `tailwind.config.*` - Styling framework
- `.env.example` - Environment variable templates

## Essential Documentation
- `README.md` - Project overview and setup
- `CHANGELOG.md` - Version history
- `*/README.md` - Package/service documentation
- `docs/architecture/*.md` - System architecture
- `docs/api/*.md` - API documentation
- `ADR-*.md` - Architecture decision records (root level)

## Critical Assets
- `public/assets/critical/**` - Essential UI assets
- `src/assets/icons/**` - Application icons
- `docs/images/architecture/**` - Architecture diagrams

## Exclude Everything Else
The `.warpignore` file excludes:
- 470M+ of `node_modules/` dependencies
- 4,298+ markdown files (keeping only essential ones above)
- Build artifacts (`dist/`, `build/`, `coverage/`)
- Temporary directories (`Link-*/`)
- Log files and IDE configs
- Large media files (unless in critical paths)
- Environment files with secrets

## Expected Token Reduction
- **Before**: ~4,500+ files indexed (including all .md files)
- **After**: ~500-800 essential files indexed
- **Token Reduction**: 80-90% fewer tokens per AI query
- **Performance**: Faster AI responses, better context focus

## Validation Commands
```bash
# Test what would be indexed (if warp supports --dry-run)
warp ignore --dry-run

# Count files that would be included vs excluded
find . -type f | wc -l  # Total files
find . -type f | grep -v -f .warpignore | wc -l  # Would be indexed

# Verify essential files are included
find . -name "*.ts" -o -name "*.go" -o -name "*.tsx" | head -10
find . -name "README.md" -o -name "package.json" | head -10
```
