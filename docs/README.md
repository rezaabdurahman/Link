# Link Chat Summarization - Documentation

This directory contains versioned API documentation and specifications for the Link Chat Summarization project.

## API Documentation

### Current Version: v1.0.0

- **AI Service OpenAPI Spec**: [v1.0.0/ai-service-openapi.yaml](./api/v1.0.0/ai-service-openapi.yaml)
- **Release Date**: January 15, 2024
- **Changelog**: [CHANGELOG.md](../CHANGELOG.md)

## API Versions

| Version | Release Date | Status | Documentation |
|---------|--------------|---------|---------------|
| v1.0.0 | 2024-01-15 | Current | [OpenAPI Spec](./api/v1.0.0/ai-service-openapi.yaml) |

## Service Documentation

### AI Service (ai-svc)
- **README**: [backend/ai-svc/README.md](../backend/ai-svc/README.md)
- **OpenAPI Spec**: [backend/ai-svc/api/openapi.yaml](../backend/ai-svc/api/openapi.yaml)
- **Implementation Guide**: [backend/ai-svc/internal/ai/README.md](../backend/ai-svc/internal/ai/README.md)

## Architecture Documentation

- **Main README**: [README.md](../README.md)
- **Architecture Decision Records**: [docs/adr/](../docs/adr/)

## Getting Started

1. **Development Setup**: See [README.md](../README.md#quick-start)
2. **AI Service Setup**: See [backend/ai-svc/README.md](../backend/ai-svc/README.md#quick-start)
3. **API Usage Examples**: See service-specific documentation

## API Base URLs

| Environment | Base URL | Description |
|-------------|----------|-------------|
| Development | `http://localhost:8081` | Local development |
| Staging | `https://staging-api.link-app.com` | Staging environment |
| Production | `https://api.link-app.com` | Production environment |

## Authentication

All API endpoints require JWT authentication:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Support

For questions about the API or documentation:

1. Check the service-specific README files
2. Review the OpenAPI specifications
3. See the [CHANGELOG.md](../CHANGELOG.md) for recent changes

---

Last updated: January 15, 2024
