# Terraform Conversion Suitability Matrix

> **Generated**: 2025-01-20  
> **Purpose**: Assessment of which scripts can be converted to Terraform infrastructure-as-code

## Suitability Framework

### 🟢 **High Suitability** 
Pure infrastructure provisioning/configuration that benefits from Terraform's:
- **Idempotency**: Can be applied multiple times safely
- **State management**: Resource lifecycle tracking 
- **Declarative syntax**: Desired state configuration
- **Provider ecosystem**: Native resource support

### 🟡 **Medium Suitability**
Mixed infrastructure + application logic requiring hybrid approach:
- **Infrastructure parts** → Terraform modules
- **Application logic** → CI/CD jobs triggered after Terraform apply
- **Configuration** → Terraform templates and variables

### 🔴 **Low Suitability** 
Development tools and runtime diagnostics better suited for scripting:
- **Dynamic behavior**: Runtime decisions and branching logic
- **Interactive elements**: User input and real-time feedback
- **Testing workflows**: Complex validation and reporting
- **Development utilities**: Ad-hoc debugging and troubleshooting

## Complete Suitability Assessment

| Script | Suitability | Terraform Strategy | Justification | Recommended Action |
|--------|:-----------:|------------------|---------------|-------------------|
| **Infrastructure & Configuration Scripts** |
| `setup-secure-monitoring.sh` | 🟢 **High** | **monitoring-stack** module | Pure infra: SSL certs, secrets, config files → `tls_*`, `random_*`, `kubernetes_*` resources | Convert to Terraform module |
| `generate-certs.sh` | 🟢 **High** | **tls-certificates** module | Certificate generation → `tls_private_key`, `tls_self_signed_cert` resources | ✅ **Already implemented** |
| `deploy-database-monitoring-v2.sh` | 🟡 **Medium** | Hybrid: infra + CI job | Config files → Terraform, Go integration → post-apply CI job | Split approach |
| `deploy-database-monitoring.sh` | 🟡 **Medium** | Hybrid: extend existing TF | Grafana dashboards, Prometheus rules → `local_file` + `kubernetes_config_map` | Extend database TF module |
| `start-dev.sh` | 🟡 **Medium** | Hybrid: infra setup + orchestration | Docker network, volumes → Terraform, service startup → script | Keep orchestration logic |
| `docker-entrypoint.sh` | 🔴 **Low** | Keep as container script | Runtime initialization, service-specific logic | No change needed |
| **Testing & Validation Scripts** |
| `smoke-test.sh` | 🔴 **Low** | CI/CD job with artifacts | Health check logic, API testing, dynamic validation | Integrate into CI pipeline |
| `security_tests.sh` | 🔴 **Low** | CI/CD security job | JWT manipulation, dynamic testing, interactive flows | Post-deployment CI job |
| `security_tests_simple.sh` | 🔴 **Low** | CI/CD demo job | Educational/demo content, simple validation | CI job for documentation |
| `test-database-monitoring.sh` | 🔴 **Low** | CI/CD validation job | Integration testing, health checks, validation logic | Post-TF-apply validation |
| `integration-tests.sh` (backend) | 🔴 **Low** | Keep in existing CI | Complex testing logic, service coordination | Already in ci.yml |
| `integration-tests.sh` (mtls) | 🔴 **Low** | CI/CD job after cert generation | mTLS testing requires running services, validation logic | Post-cert-generation CI job |
| `test-mtls.sh` | 🔴 **Low** | CI/CD connectivity test | Runtime connectivity testing | CI job dependency |
| `rate_limiting_test.sh` | 🔴 **Low** | CI/CD performance job | Dynamic load generation and validation | Performance testing CI job |
| **Performance & Load Scripts** |
| `basic-load-test.js` | 🔴 **Low** | CI/CD performance suite | Dynamic load generation, results analysis | Scheduled CI job |
| `frontend-load-test.js` | 🔴 **Low** | CI/CD performance suite | Frontend-specific testing logic | Scheduled CI job |

## Conversion Strategy by Category

### 🟢 High Suitability (3 scripts → 2 Terraform modules)

#### 1. `monitoring/setup-secure-monitoring.sh` → `modules/monitoring-stack`
```hcl
# SSL certificates
resource "tls_private_key" "monitoring" { ... }
resource "tls_self_signed_cert" "monitoring" { ... }

# Secrets generation  
resource "random_password" "grafana_admin" { ... }
resource "random_password" "redis_auth" { ... }

# Kubernetes configuration
resource "kubernetes_secret" "monitoring_secrets" { ... }
resource "kubernetes_config_map" "nginx_config" { ... }
```
**Benefits**: Secure secret handling, reproducible SSL setup, version-controlled config

#### 2. `poc/mtls-example/scripts/generate-certs.sh` → `modules/tls-certificates` 
✅ **Already implemented** - Complete PKI certificate chain in Terraform
**Benefits**: State-managed certificates, automatic renewal, Kubernetes integration

### 🟡 Medium Suitability (3 scripts → Hybrid approach)

#### 1. Database Monitoring Scripts → Extended Terraform + CI
**Terraform handles**: 
- Prometheus rule files (`local_file`)
- Grafana dashboard JSON (`kubernetes_config_map`) 
- Service configuration templates

**CI/CD handles**:
- Go library integration verification
- Service restart coordination  
- Health check validation

#### 2. `start-dev.sh` → Development Environment Module
**Terraform handles**:
- Docker networks and volumes
- Environment variable files
- Port mappings configuration

**Script handles**:
- Service orchestration (docker-compose up)
- Health check polling
- Development workflow

### 🔴 Low Suitability (10 scripts → CI/CD integration)

#### Testing & Validation Pipeline Enhancement
New GitHub Actions workflow: `.github/workflows/post-deploy-validation.yml`

```yaml
jobs:
  infrastructure-tests:
    needs: [terraform-apply]
    steps:
      - name: Run smoke tests
        run: ./smoke-test.sh
      - name: Security validation  
        run: ./security_tests.sh
      - name: Performance baseline
        run: npm run test:load:basic
```

## Implementation Roadmap

### Phase 1: High-Impact Infrastructure (Weeks 1-2)
- ✅ TLS certificates module (completed)
- 🔄 Monitoring stack module (in progress)
- 📋 Extend database Terraform with monitoring resources

### Phase 2: Hybrid Implementation (Weeks 3-4) 
- 🔄 Database monitoring hybrid approach
- 🔄 Development environment Terraform module
- 📋 CI/CD jobs for remaining application logic

### Phase 3: CI/CD Integration (Weeks 5-6)
- 📋 Post-deployment validation workflow
- 📋 Security testing automation
- 📋 Performance testing integration  

### Phase 4: Production Enablement (Week 7)
- 📋 Environment-specific workspaces
- 📋 Production approval gates
- 📋 Monitoring and alerting integration

## Expected Outcomes

### Quantitative Impact
- **32% of scripts** (6/19) converted to pure Terraform
- **16% hybrid approach** (3/19) infrastructure via Terraform  
- **52% remain scripts** (10/19) but gain CI/CD automation
- **Zero manual infrastructure steps** in production

### Qualitative Benefits
- **Consistency**: Infrastructure matches code expectations
- **Reproducibility**: Environment parity across dev/staging/prod  
- **Security**: Secret management via Terraform providers
- **Observability**: All infrastructure changes tracked in state
- **Team velocity**: Reduced deployment complexity and debugging

## Risk Assessment & Mitigations

### Medium Risk Items
| Risk | Impact | Mitigation |
|------|---------|-----------|
| **Certificate renewal complexity** | Service outages | Automated renewal + monitoring alerts |
| **Terraform state conflicts** | Deployment failures | Remote state with locking, team workflows |
| **Hybrid approach coordination** | Inconsistent deployments | Clear dependencies, validation gates |

### Low Risk Items  
- Testing script integration (existing CI patterns)
- Development workflow changes (gradual adoption)
- Team learning curve (strong existing Terraform foundation)

## Success Criteria

### Technical Metrics
- [ ] All infrastructure scripts converted or hybrid approach implemented
- [ ] Zero production deployments using manual scripts  
- [ ] All environments provisioned via Terraform workspaces
- [ ] Test automation integrated into CI/CD pipeline

### Team Adoption Metrics
- [ ] Team trained on new Terraform modules
- [ ] Documentation updated and accessible
- [ ] Runbooks reflect new deployment procedures
- [ ] Post-deployment validation automated

---

**Next Step**: Review this assessment with the team and proceed with Phase 1 implementation.

*Related documents: `scripts-inventory.md`, `terraform/modules/tls-certificates/README.md`*
