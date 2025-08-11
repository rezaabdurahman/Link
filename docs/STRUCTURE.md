# Documentation Structure

This document defines the target information architecture for the documentation portal, organized to provide clear paths for different user personas and use cases.

## Directory Structure

```
docs/
├── index.md                # Portal landing page
├── getting-started/        # Quick start & setup
├── architecture/           # High-level diagrams
├── backend/                # Per-service docs
├── frontend/               # React/Vite docs
├── devops/                 # CI/CD, docker, infra
├── processes/              # Rules, contributing, coding standards
└── references/             # API specs, data models
```

## Navigation Hierarchy

### MkDocs Configuration (mkdocs.yml)

```yaml
nav:
  - Home: index.md
  - Getting Started:
    - getting-started/index.md
    - Installation: getting-started/installation.md
    - Quick Start: getting-started/quick-start.md
    - Configuration: getting-started/configuration.md
    - First Steps: getting-started/first-steps.md
  - Architecture:
    - architecture/index.md
    - System Overview: architecture/system-overview.md
    - Data Flow: architecture/data-flow.md
    - Security: architecture/security.md
    - Scalability: architecture/scalability.md
  - Backend:
    - backend/index.md
    - API Gateway: backend/api-gateway.md
    - Authentication Service: backend/auth-service.md
    - Data Services: backend/data-services.md
    - Background Jobs: backend/background-jobs.md
    - Database Schema: backend/database.md
  - Frontend:
    - frontend/index.md
    - Getting Started: frontend/getting-started.md
    - Component Library: frontend/components.md
    - State Management: frontend/state-management.md
    - Routing: frontend/routing.md
    - Build & Deploy: frontend/build-deploy.md
  - DevOps:
    - devops/index.md
    - Docker Setup: devops/docker.md
    - CI/CD Pipeline: devops/ci-cd.md
    - Infrastructure: devops/infrastructure.md
    - Monitoring: devops/monitoring.md
    - Deployment: devops/deployment.md
  - Development Processes:
    - processes/index.md
    - Contributing: processes/contributing.md
    - Code Standards: processes/coding-standards.md
    - Git Workflow: processes/git-workflow.md
    - Code Review: processes/code-review.md
    - Testing Guidelines: processes/testing.md
  - References:
    - references/index.md
    - API Documentation: references/api.md
    - Data Models: references/data-models.md
    - Configuration: references/configuration.md
    - Glossary: references/glossary.md
```

### Docusaurus Configuration (docusaurus.config.js)

```javascript
module.exports = {
  themeConfig: {
    navbar: {
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
      ],
    },
  },
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: '/',
        },
      },
    ],
  ],
};
```

### Docusaurus Sidebar Configuration (sidebars.js)

```javascript
module.exports = {
  tutorialSidebar: [
    'index',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/index',
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/configuration',
        'getting-started/first-steps',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: true,
      items: [
        'architecture/index',
        'architecture/system-overview',
        'architecture/data-flow',
        'architecture/security',
        'architecture/scalability',
      ],
    },
    {
      type: 'category',
      label: 'Backend',
      collapsed: true,
      items: [
        'backend/index',
        'backend/api-gateway',
        'backend/auth-service',
        'backend/data-services',
        'backend/background-jobs',
        'backend/database',
      ],
    },
    {
      type: 'category',
      label: 'Frontend',
      collapsed: true,
      items: [
        'frontend/index',
        'frontend/getting-started',
        'frontend/components',
        'frontend/state-management',
        'frontend/routing',
        'frontend/build-deploy',
      ],
    },
    {
      type: 'category',
      label: 'DevOps',
      collapsed: true,
      items: [
        'devops/index',
        'devops/docker',
        'devops/ci-cd',
        'devops/infrastructure',
        'devops/monitoring',
        'devops/deployment',
      ],
    },
    {
      type: 'category',
      label: 'Development Processes',
      collapsed: true,
      items: [
        'processes/index',
        'processes/contributing',
        'processes/coding-standards',
        'processes/git-workflow',
        'processes/code-review',
        'processes/testing',
      ],
    },
    {
      type: 'category',
      label: 'References',
      collapsed: true,
      items: [
        'references/index',
        'references/api',
        'references/data-models',
        'references/configuration',
        'references/glossary',
      ],
    },
  ],
};
```

## Content Strategy by Section

### 1. Portal Landing Page (index.md)
- Overview of the system and documentation
- Quick navigation to key sections
- Getting started call-to-action
- Recent updates and announcements

### 2. Getting Started
**Target Audience**: New developers, stakeholders getting oriented
- Installation and setup instructions
- Environment configuration
- First successful run/deployment
- Basic concepts and terminology

### 3. Architecture
**Target Audience**: Technical leads, senior developers, architects
- High-level system diagrams
- Service interactions and data flow
- Security architecture
- Performance and scalability considerations

### 4. Backend
**Target Audience**: Backend developers, API consumers
- Service-specific documentation
- API endpoints and usage
- Database schemas and relationships
- Background job configurations

### 5. Frontend
**Target Audience**: Frontend developers, UI/UX developers
- React/Vite setup and configuration
- Component library documentation
- State management patterns
- Build and deployment processes

### 6. DevOps
**Target Audience**: DevOps engineers, system administrators
- Docker containerization
- CI/CD pipeline configuration
- Infrastructure as code
- Monitoring and alerting setup

### 7. Development Processes
**Target Audience**: All team members
- Contributing guidelines
- Code standards and linting rules
- Git workflow and branching strategy
- Code review processes

### 8. References
**Target Audience**: All developers (reference material)
- Complete API specifications
- Data model definitions
- Configuration options
- Technical glossary

## Implementation Notes

### Content Organization Principles
1. **User-centric**: Organized by user needs and workflows
2. **Progressive disclosure**: Start with basics, drill down to specifics
3. **Cross-referencing**: Liberal use of links between related content
4. **Searchable**: Clear headings and keywords for search optimization

### Maintenance Strategy
1. **Index pages**: Each section should have an index.md that provides overview and navigation
2. **Consistent structure**: Use similar page templates across sections
3. **Regular updates**: Documentation should be updated with each release
4. **Ownership**: Each section should have designated maintainers

### Navigation Best Practices
1. **Logical flow**: Getting Started → Architecture → Implementation → Processes → References
2. **Collapsed by default**: Non-essential sections collapsed to reduce cognitive load
3. **Search integration**: Both MkDocs and Docusaurus provide excellent search capabilities
4. **Responsive design**: Navigation works well on mobile and desktop

## Next Steps
1. Create directory structure and index files
2. Port existing documentation to new structure
3. Set up documentation site (MkDocs or Docusaurus)
4. Establish content maintenance workflows
5. Gather feedback and iterate on structure
