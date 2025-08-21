# Terraform Quick Start Guide

Get up and running with Link's database isolation infrastructure in minutes.

## ⚡ Prerequisites (5 minutes)

### Required Tools
```bash
# Install Terraform
brew install terraform              # macOS
# or download from: https://terraform.io/downloads

# Install quality tools
brew install tflint tfsec terraform-docs

# Verify installation
terraform version
tflint --version
tfsec --version
```

### AWS Setup
```bash
# Configure AWS credentials
aws configure
# or set environment variables:
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_DEFAULT_REGION="us-west-2"
```

### Database Access
```bash
# Ensure PostgreSQL is running
brew services start postgresql      # macOS
sudo systemctl start postgresql    # Linux

# Test connection
psql -h localhost -U postgres -c "SELECT 1;"
```

## 🚀 Quick Setup (3 commands)

### 1. Create Remote State Infrastructure
```bash
cd terraform/
./scripts/setup-remote-state.sh
```

### 2. Initialize Development Environment
```bash
make dev-init
```

### 3. Deploy Database Isolation
```bash
# Plan first (always!)
make dev-plan

# Apply if plan looks good
make dev-apply
```

## ✅ Verify Setup

### Check Created Resources
```bash
# Show outputs
make output ENV=development

# List databases
psql -h localhost -U postgres -c "\l" | grep link_

# Test service connections
for service in users chat ai search discovery; do
  echo "Testing $service..."
  # Connection details will be in the outputs
done
```

### Run Quality Checks
```bash
# Run all quality checks
make quality

# Test backup procedures
make test-backup
```

## 📁 What You Get

After successful setup:

```
✅ Database Resources:
   • 5 isolated service databases
   • 5 service users with proper permissions
   • 1 monitoring user (optional)
   • Required extensions installed

✅ Configuration Files:
   • Environment files for each service
   • Docker Compose overrides
   • PgBouncer configuration
   • Kubernetes secrets

✅ Operational Scripts:
   • Automated backup scripts
   • Restore procedures
   • Migration utilities
```

## 🎯 Next Steps

### Development Workflow
```bash
# Make changes to .tf files
vim main.tf

# Format and validate
make format
make validate

# Plan changes
make dev-plan

# Apply if happy with plan
make dev-apply
```

### Deploy to Staging
```bash
# Plan staging deployment
make plan ENV=staging

# Apply to staging
make apply ENV=staging
```

### Production Deployment
```bash
# Extra safety checks for production
make prod-plan

# Deploy to production (with confirmations)
make prod-apply
```

## 🛠️ Common Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make dev-plan` | Quick development planning |
| `make staging-apply` | Deploy to staging |
| `make prod-plan` | Production planning with safety checks |
| `make quality` | Run all quality checks |
| `make test-backup` | Test backup procedures |
| `make docs` | Generate documentation |
| `make clean` | Clean temporary files |

## 🚨 Troubleshooting

### Common Issues

**State Lock Error**:
```bash
# Wait and retry, or force unlock
terraform force-unlock <lock-id>
```

**Database Connection Failed**:
```bash
# Check PostgreSQL is running
brew services list | grep postgresql
```

**Tool Not Found**:
```bash
# Install missing tools
make check-tools
brew install terraform tflint tfsec
```

**See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions**

## 📚 Learn More

- **Full Documentation**: [README.md](README.md)
- **Architecture Details**: [ADR-002-Distributed-Database-Strategy.md](../ADR-002-Distributed-Database-Strategy.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Assessment Report**: [ASSESSMENT.md](ASSESSMENT.md)

## 🎉 Success!

You now have a production-ready database isolation infrastructure with:
- ✅ Remote state management
- ✅ Environment isolation  
- ✅ Security scanning
- ✅ Automated testing
- ✅ Quality gates
- ✅ Comprehensive documentation

**Ready to scale your services!** 🚀