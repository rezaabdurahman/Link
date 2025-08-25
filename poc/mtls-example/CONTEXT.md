# mTLS POC Context

## Purpose
This directory contains a **Proof of Concept (POC)** for manual mTLS implementation. It demonstrates:
- Manual certificate handling and validation
- Service-to-service authentication patterns
- TLS configuration best practices
- Gateway proxy patterns with mTLS

## Production Usage
**⚠️ Important**: This POC is NOT used in production. The Link project uses:
- **Linkerd service mesh** for automatic mTLS between services
- **API Gateway** with more advanced routing and authentication
- **Terraform-managed certificates** for production TLS

## Relevance
This POC remains valuable for:
- 📚 **Education**: Understanding mTLS concepts and implementation
- 🔧 **Debugging**: Troubleshooting TLS issues in development
- 🧪 **Testing**: Validating certificate configurations
- 📖 **Documentation**: Referenced in security architecture docs

## Related Production Components
- `k8s/linkerd/services-with-mtls.yaml` - Production mTLS configuration
- `terraform/modules/tls-certificates/` - Certificate management
- `backend/api-gateway/` - Production gateway implementation
- `docs/security/mtls-design.md` - Architecture documentation

## How to Use
1. **For Learning**: Study the code to understand mTLS concepts
2. **For Testing**: Use `make test-mtls` to validate TLS configurations
3. **For Reference**: Compare with production Linkerd setup
4. **For Debugging**: Run locally when troubleshooting TLS issues

## Last Updated
August 2025 - Cleaned up duplicates, added context documentation