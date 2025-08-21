# Scripts Inventory

> **Generated**: 2025-01-20  
> **Purpose**: Complete catalog of all scripts in the Link distributed architecture project for Terraform conversion assessment

## Summary

- **Total Scripts**: 19
- **Root Level**: 4 scripts
- **Organized Directories**: 15 scripts  
- **Languages**: Bash (16), JavaScript (3)

## Complete Script Inventory

| Path | Name | Description | Environment(s) Affected | Script Type |
|------|------|-------------|------------------------|-------------|
| **Root Level Scripts** |
| `./` | `start-dev.sh` | Development environment startup orchestrator | Development | DevOps |
| `./` | `smoke-test.sh` | Quick health checks and API validation | Development, Staging | Testing |
| `./` | `security_tests.sh` | Comprehensive security testing (JWT, CORS, headers) | Development, Testing | Security |
| `./` | `security_tests_simple.sh` | Simplified security test demonstrations | Development | Security |
| **Scripts Directory** |
| `scripts/` | `deploy-database-monitoring-v2.sh` | Comprehensive database monitoring deployment | All environments | Infrastructure |
| `scripts/` | `deploy-database-monitoring.sh` | Basic database monitoring setup | All environments | Infrastructure |
| `scripts/` | `test-database-monitoring.sh` | Database monitoring integration validation | Development, Testing | Testing |
| **Backend Scripts** |
| `backend/discovery-svc/` | `docker-entrypoint.sh` | Service startup and initialization script | All environments | Runtime |
| `backend/` | `integration-tests.sh` | Backend integration testing suite | Development, CI | Testing |
| **Monitoring Scripts** |
| `monitoring/` | `setup-secure-monitoring.sh` | Secure monitoring stack setup (SSL, auth, secrets) | All environments | Infrastructure |
| **POC/Example Scripts** |
| `poc/mtls-example/` | `integration-tests.sh` | mTLS functionality testing and validation | Development, Testing | Testing |
| `poc/mtls-example/` | `test-mtls.sh` | mTLS connection and certificate tests | Development | Testing |
| `poc/mtls-example/scripts/` | `generate-certs.sh` | Certificate generation for mTLS PKI chain | Development, Testing | Infrastructure |
| **Test Scripts** |
| `tests/load/` | `basic-load-test.js` | Basic load testing with configurable scenarios | Testing, Staging | Performance |
| `tests/load/` | `frontend-load-test.js` | Frontend-specific load testing | Testing, Staging | Performance |
| `security_test_results/` | `rate_limiting_test.sh` | Rate limiting validation and bypass testing | Testing | Security |

## Script Categories by Purpose

### 🏗️ Infrastructure & Configuration (6 scripts)
- `deploy-database-monitoring-v2.sh` - Database monitoring deployment
- `deploy-database-monitoring.sh` - Basic monitoring setup
- `setup-secure-monitoring.sh` - Secure monitoring stack
- `generate-certs.sh` - TLS certificate generation
- `start-dev.sh` - Development environment setup
- `docker-entrypoint.sh` - Service runtime initialization

### 🧪 Testing & Validation (7 scripts)
- `smoke-test.sh` - Health check validation
- `security_tests.sh` - Comprehensive security testing
- `security_tests_simple.sh` - Simplified security tests
- `test-database-monitoring.sh` - Monitoring validation
- `integration-tests.sh` (backend) - Backend integration tests
- `integration-tests.sh` (mtls) - mTLS integration tests
- `test-mtls.sh` - mTLS functionality tests

### ⚡ Performance & Load (3 scripts)
- `basic-load-test.js` - Basic load testing
- `frontend-load-test.js` - Frontend load testing
- `rate_limiting_test.sh` - Rate limiting tests

### 🔒 Security Testing (3 scripts)
- `security_tests.sh` - JWT manipulation, header spoofing
- `security_tests_simple.sh` - Security test demonstrations
- `rate_limiting_test.sh` - Rate limiting validation

## Environment Matrix

| Script | Development | Testing | Staging | Production | CI/CD |
|--------|:-----------:|:-------:|:-------:|:----------:|:-----:|
| `start-dev.sh` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `smoke-test.sh` | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| `security_tests*.sh` | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| `deploy-database-monitoring*.sh` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `setup-secure-monitoring.sh` | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| `generate-certs.sh` | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| `integration-tests.sh` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `*-load-test.*` | ❌ | ✅ | ✅ | ⚠️ | ✅ |

**Legend**: ✅ = Regularly used, ⚠️ = Occasionally used, ❌ = Not used

## Complexity Assessment

### Simple Scripts (8)
- Basic health checks, simple tests
- Single responsibility
- Minimal external dependencies

### Medium Complexity (7)
- Multi-step processes
- External service coordination
- Configuration management

### Complex Scripts (4)
- `deploy-database-monitoring-v2.sh` - 500+ lines, comprehensive deployment
- `security_tests.sh` - Advanced security testing
- `setup-secure-monitoring.sh` - SSL, certificates, authentication
- `generate-certs.sh` - PKI certificate chain management

## Dependencies Analysis

### External Tool Dependencies
- **Docker & Docker Compose**: 8 scripts
- **curl**: 12 scripts  
- **jq**: 6 scripts
- **openssl**: 3 scripts
- **go**: 3 scripts
- **npm/node**: 3 scripts

### Service Dependencies
- **PostgreSQL**: 4 scripts
- **Redis**: 2 scripts  
- **Kubernetes**: 3 scripts
- **Prometheus/Grafana**: 3 scripts

## Integration Points

### Current CI/CD Integration
Scripts already integrated in `.github/workflows/`:
- `backend/integration-tests.sh` → `ci.yml`
- Load testing scripts → Manual/planned integration
- Security tests → Not yet integrated

### Dockerfile Integration
- `backend/discovery-svc/docker-entrypoint.sh` → Used in service containers

### Development Workflow Integration  
- `start-dev.sh` → Primary development startup
- `smoke-test.sh` → Development validation
- mTLS scripts → POC and testing workflows

## Recommendations for Next Steps

1. **High Priority for Terraform**: Infrastructure scripts (6 scripts)
2. **CI/CD Integration**: Testing scripts (7 scripts) 
3. **Keep as Scripts**: Runtime and complex testing logic (6 scripts)

## Notes

- All scripts follow conventional Unix patterns
- Most include proper error handling (`set -e`)
- Color output and user-friendly messaging are common
- Scripts are well-documented with inline comments
- File permissions are properly managed (executable scripts)

---
*This inventory was generated as part of the Terraform migration assessment. See `terraform-suitability.md` for conversion recommendations.*
