# Link Platform Documentation

Welcome to the Link platform documentation! This comprehensive guide covers all aspects of the social discovery platform, from setup to production deployment.

## 🏗️ Documentation Structure

This documentation is organized into logical sections for different audiences and use cases:

### 🚀 [Getting Started](./getting-started/)
Perfect for new developers and team members
- **Quick Start** - Get up and running in minutes
- **Local Development** - Set up your development environment
- **Configuration Guide** - Environment and service configuration

### 🏗️ [Architecture](./architecture/)
For understanding system design and making informed decisions
- **System Overview** - High-level platform architecture
- **[Service Discovery](./architecture/service-discovery.md)** - Load balancing and service mesh
- **Microservices Design** - Service boundaries and communication
- **[ADRs](./architecture/adr/)** - Architecture Decision Records
  - [001: Domain Boundaries](./architecture/adr/001-domain-boundaries.md)
  - [002: Database Strategy](./architecture/adr/002-database-strategy.md)

### 🚀 [Deployment](./deployment/)
For DevOps engineers and deployment workflows
- **[Deployment Overview](./deployment/overview.md)** - Comprehensive deployment strategy
- **[Docker Compose](./deployment/docker-compose.md)** - Local development deployment
- **[Kubernetes](./deployment/kubernetes.md)** - Production Kubernetes deployment
- **CI/CD Pipeline** - Continuous integration and deployment

### 🔐 [Security](./security/)
For security engineers and compliance requirements
- **[Security Overview](./security/overview.md)** - Security architecture and threat model
- **[Authentication](./security/authentication.md)** - JWT authentication and authorization
- **Database Security** - Database isolation and encryption
- **mTLS Configuration** - Service mesh security
- **Security Testing** - Security testing procedures

### 📊 [Observability](./observability/)
For SRE and operations teams
- **[Monitoring Overview](./observability/overview.md)** - Comprehensive observability strategy
- **Metrics Implementation** - Application and infrastructure metrics
- **Logging Configuration** - Structured logging and aggregation
- **Alerting Setup** - Alert configuration and incident management
- **Dashboard Creation** - Grafana dashboard setup

### 📡 [API Documentation](./api/)
For frontend developers and API consumers
- **API Overview** - API design principles and standards
- **[Service APIs](./api/services/)** - Per-service API documentation
  - User Service
  - Chat Service
  - Discovery Service
  - AI Service
  - Search Service

### 🔧 [Operations](./operations/)
For production operations and maintenance
- **Troubleshooting Guide** - Common issues and solutions
- **Database Operations** - Database management and maintenance
- **Backup & Recovery** - Data backup and disaster recovery
- **Runbooks** - Step-by-step operational procedures

## 🎯 Quick Navigation

### I want to...
- **Start developing locally** → [Quick Start Guide](../README.md#-quick-start)
- **Deploy to production** → [Kubernetes Deployment](./deployment/kubernetes.md)
- **Understand the architecture** → [Architecture Overview](./architecture/)
- **Implement security** → [Security Overview](./security/overview.md)
- **Set up monitoring** → [Observability Overview](./observability/overview.md)
- **Integrate with APIs** → [API Documentation](./api/)
- **Troubleshoot issues** → [Operations Documentation](./operations/)

### I am a...
- **New Developer** → [Getting Started](./getting-started/) → [Architecture](./architecture/)
- **DevOps Engineer** → [Deployment](./deployment/) → [Operations](./operations/)
- **Security Engineer** → [Security](./security/) → [Operations](./operations/)
- **Frontend Developer** → [API Documentation](./api/) → [Main README](../README.md)
- **SRE/Operations** → [Observability](./observability/) → [Operations](./operations/)

## 🔄 Document Maintenance

### Contributing to Documentation
- Documentation follows the same Git workflow as code
- All documentation changes require review
- Keep documentation up-to-date with code changes
- Use clear, concise language and provide examples

### Documentation Standards
- Use markdown format for all documentation
- Include code examples for configuration
- Add diagrams for complex concepts (Mermaid preferred)
- Keep links relative within the documentation

---

**Happy building!** 🚀

The Link platform documentation is designed to help you be productive quickly while providing deep technical information when you need it.