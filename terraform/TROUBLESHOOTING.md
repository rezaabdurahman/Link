# Terraform Troubleshooting Guide

This guide helps you resolve common issues when working with the Link project's Terraform infrastructure.

## 🚨 Common Issues

### State Management Issues

#### Issue: "Error acquiring the state lock"
```
Error: Error acquiring the state lock

Error message: ConditionalCheckFailedException: The conditional request failed
Lock Info:
  ID:        12345678-1234-1234-1234-123456789012
  Path:      link-terraform-state-dev/database-isolation/terraform.tfstate
  Operation: OperationTypePlan
  Who:       user@example.com
  Version:   1.5.7
  Created:   2025-01-19 10:30:00 UTC
  Info:      
```

**Cause**: Another Terraform process is holding the state lock, or a previous process crashed without releasing it.

**Solutions**:
1. **Wait and retry**: Another team member might be running Terraform
2. **Force unlock** (use carefully):
   ```bash
   terraform force-unlock 12345678-1234-1234-1234-123456789012
   ```
3. **Check AWS Console**: Verify the DynamoDB lock table for stuck locks

**Prevention**:
- Always use `terraform plan` before `terraform apply`
- Don't kill Terraform processes abruptly
- Use proper CI/CD pipelines to avoid concurrent runs

---

#### Issue: "Backend configuration changed"
```
Error: Backend configuration changed

A change in the backend configuration has been detected, which may require migrating existing state.
```

**Cause**: Backend configuration in `backend.tf` differs from the initialized state.

**Solutions**:
1. **Reconfigure backend**:
   ```bash
   terraform init -reconfigure
   ```
2. **Migrate state** if intentional:
   ```bash
   terraform init -migrate-state
   ```

---

### Environment Configuration Issues

#### Issue: "No such file or directory: terraform.tfvars"
```
Error: Failed to load variables

Could not load variable file "environments/production/terraform.tfvars":
open environments/production/terraform.tfvars: no such file or directory
```

**Cause**: Missing environment-specific configuration file.

**Solutions**:
1. **Check environment name**:
   ```bash
   ls environments/
   # Verify spelling: development, staging, production
   ```
2. **Copy from template**:
   ```bash
   cp environments/development/terraform.tfvars environments/production/terraform.tfvars
   # Edit with production values
   ```

---

#### Issue: "Invalid environment 'prod'"
```
Error: Invalid environment 'prod'. Valid options: development staging production
```

**Cause**: Using abbreviated environment name.

**Solutions**:
- Use full environment names:
  ```bash
  make plan ENV=production  # ✅ Correct
  make plan ENV=prod        # ❌ Wrong
  ```

---

### Database Connection Issues

#### Issue: "Connection refused" to PostgreSQL
```
Error: Error connecting to PostgreSQL server:
pq: dial tcp [::1]:5432: connect: connection refused
```

**Cause**: PostgreSQL server is not running or not accessible.

**Solutions**:
1. **Check PostgreSQL status**:
   ```bash
   # macOS with Homebrew
   brew services list | grep postgresql
   brew services start postgresql
   
   # Linux with systemd
   sudo systemctl status postgresql
   sudo systemctl start postgresql
   
   # Docker
   docker ps | grep postgres
   docker-compose up -d postgres
   ```

2. **Verify connection settings**:
   ```bash
   psql -h localhost -p 5432 -U link_user -d link_app
   ```

3. **Check firewall/network**:
   ```bash
   telnet localhost 5432
   ```

---

#### Issue: "Password authentication failed"
```
Error: pq: password authentication failed for user "link_user"
```

**Cause**: Incorrect database credentials.

**Solutions**:
1. **Verify credentials**:
   ```bash
   # Check if user exists
   sudo -u postgres psql -c "\du link_user"
   
   # Reset password if needed
   sudo -u postgres psql -c "ALTER USER link_user PASSWORD 'new_password';"
   ```

2. **Update terraform.tfvars**:
   ```hcl
   postgres_password = "correct_password"
   ```

3. **Check environment variables**:
   ```bash
   echo $POSTGRES_PASSWORD
   ```

---

### Provider and Module Issues

#### Issue: "Could not retrieve the list of available versions for provider"
```
Error: Failed to install provider

Could not retrieve the list of available versions for provider hashicorp/postgresql:
no available releases match the given constraints >= 1.21.0, < 2.0.0
```

**Cause**: Network issues or provider version constraints.

**Solutions**:
1. **Check internet connection**:
   ```bash
   curl -I https://registry.terraform.io/
   ```

2. **Clear provider cache**:
   ```bash
   rm -rf .terraform/
   terraform init
   ```

3. **Check version constraints** in `versions.tf`:
   ```hcl
   postgresql = {
     source  = "cyrilgdn/postgresql"
     version = "= 1.21.0"  # Use exact version
   }
   ```

---

#### Issue: "Module not found"
```
Error: Module not found

Could not find module "./modules/service-databases"
```

**Cause**: Running Terraform from wrong directory or missing module files.

**Solutions**:
1. **Check current directory**:
   ```bash
   pwd
   ls -la modules/
   ```

2. **Run from correct directory**:
   ```bash
   cd terraform/
   terraform init
   ```

---

### Resource Creation Issues

#### Issue: "Database already exists"
```
Error: Error creating database: pq: database "link_users" already exists
```

**Cause**: Database was created outside of Terraform or state is out of sync.

**Solutions**:
1. **Import existing resource**:
   ```bash
   terraform import 'module.service_databases.postgresql_database.service_databases["users"]' link_users
   ```

2. **Check state**:
   ```bash
   terraform state list | grep database
   ```

3. **Refresh state**:
   ```bash
   terraform refresh -var-file="environments/development/terraform.tfvars"
   ```

---

#### Issue: "Permission denied for database"
```
Error: pq: permission denied for database "link_users"
```

**Cause**: Insufficient privileges for the PostgreSQL user.

**Solutions**:
1. **Grant permissions manually**:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE link_users TO link_users_user;
   ```

2. **Use superuser for Terraform**:
   ```hcl
   postgres_username = "postgres"  # Use superuser
   ```

---

### Performance Issues

#### Issue: "Timeout while waiting for plugin to start"
```
Error: timeout while waiting for plugin to start
```

**Cause**: Resource constraints or network timeouts.

**Solutions**:
1. **Increase timeout**:
   ```bash
   export TF_PLUGIN_TIMEOUT=300  # 5 minutes
   ```

2. **Check system resources**:
   ```bash
   top
   df -h
   ```

3. **Run with parallelism limit**:
   ```bash
   terraform apply -parallelism=2
   ```

---

### Quality Check Issues

#### Issue: "TFLint not found"
```
Error: tflint not found. Install with: brew install tflint
```

**Cause**: Missing required tools.

**Solutions**:
1. **Install missing tools**:
   ```bash
   # macOS
   brew install terraform tflint tfsec terraform-docs
   
   # Check installation
   make check-tools
   ```

2. **Use Docker alternative**:
   ```bash
   docker run --rm -v $(pwd):/data -t ghcr.io/terraform-linters/tflint
   ```

---

#### Issue: "Security scan failed"
```
Error: Security scan failed
Result 1

  [aws-s3-bucket-public-read-prohibited]
  Resource 'aws_s3_bucket.example'
```

**Cause**: Security policy violations detected.

**Solutions**:
1. **Fix the security issue**:
   ```hcl
   resource "aws_s3_bucket_public_access_block" "example" {
     bucket = aws_s3_bucket.example.id
     
     block_public_acls       = true
     block_public_policy     = true
     ignore_public_acls      = true
     restrict_public_buckets = true
   }
   ```

2. **Suppress if acceptable** (not recommended):
   ```yaml
   # .tfsec.yml
   exclude:
     - aws-s3-bucket-public-read-prohibited
   ```

---

## 🛠️ Diagnostic Commands

### Environment Information
```bash
# Show current environment
make version
terraform version

# Check tool availability  
make check-tools

# Show current state
make show ENV=development
make output ENV=development
```

### State Debugging
```bash
# List all resources
terraform state list

# Show specific resource
terraform state show 'module.service_databases.postgresql_database.service_databases["users"]'

# Pull remote state
terraform state pull > state.json
```

### Network Debugging
```bash
# Test database connectivity
telnet localhost 5432

# Test DNS resolution
nslookup postgres.staging.svc.cluster.local

# Check listening ports
netstat -tlnp | grep 5432
```

### Log Analysis
```bash
# Enable debug logging
export TF_LOG=DEBUG
terraform plan

# Save logs to file
export TF_LOG_PATH=terraform.log
terraform apply
```

---

## 🚀 Recovery Procedures

### State Corruption Recovery
1. **Backup current state**:
   ```bash
   terraform state pull > state-backup-$(date +%Y%m%d_%H%M%S).json
   ```

2. **List resources**:
   ```bash
   terraform state list > resources.txt
   ```

3. **Remove corrupted resources**:
   ```bash
   terraform state rm 'module.service_databases.postgresql_database.service_databases["problematic"]'
   ```

4. **Re-import if needed**:
   ```bash
   terraform import 'module.service_databases.postgresql_database.service_databases["users"]' link_users
   ```

### Complete Environment Reset
```bash
# 1. Backup everything
terraform state pull > full-state-backup.json
cp -r environments/ environments-backup/

# 2. Clean Terraform
make clean

# 3. Re-initialize
make init ENV=development

# 4. Plan and verify
make plan ENV=development

# 5. Apply if plan looks good
make apply ENV=development
```

### Database Recovery
```bash
# 1. Test backup script
make test-backup

# 2. Create manual backup
pg_dump -h localhost -U link_user link_users > manual_backup.sql

# 3. Restore if needed
psql -h localhost -U link_user link_users < manual_backup.sql
```

---

## 📞 Getting Help

### Internal Resources
1. **Check documentation**:
   - `README.md` - Main documentation
   - `ASSESSMENT.md` - Current status and improvements
   - Module READMEs in `modules/*/`

2. **Run diagnostic commands**:
   ```bash
   make quality          # Run all quality checks
   make validate-all     # Validate all environments
   make test-backup      # Test backup procedures
   ```

### External Resources
1. **Terraform Documentation**: https://terraform.io/docs
2. **PostgreSQL Provider**: https://registry.terraform.io/providers/cyrilgdn/postgresql
3. **AWS Provider**: https://registry.terraform.io/providers/hashicorp/aws
4. **TFLint Rules**: https://github.com/terraform-linters/tflint-ruleset-aws
5. **TFSec Checks**: https://aquasecurity.github.io/tfsec/

### Community Support
1. **Terraform Community**: https://discuss.hashicorp.com/c/terraform-core
2. **PostgreSQL Community**: https://www.postgresql.org/support/
3. **Stack Overflow**: Use tags `terraform`, `postgresql`, `aws`

---

## 🔍 Debug Checklist

When encountering issues, work through this checklist:

- [ ] **Environment**: Confirm you're in the right environment and directory
- [ ] **Tools**: Verify all required tools are installed (`make check-tools`)
- [ ] **Connectivity**: Test database and AWS connectivity
- [ ] **State**: Check if state is locked or corrupted
- [ ] **Configuration**: Validate all configuration files
- [ ] **Logs**: Enable debug logging and review output
- [ ] **Resources**: Check if resources exist outside Terraform
- [ ] **Permissions**: Verify AWS and database permissions
- [ ] **Network**: Test network connectivity and DNS resolution
- [ ] **Backups**: Ensure you have recent backups before major changes

---

## 📝 Reporting Issues

When reporting issues, include:

1. **Environment**: Which environment (dev/staging/prod)?
2. **Command**: Exact command that failed
3. **Error**: Complete error message
4. **Context**: What were you trying to accomplish?
5. **Logs**: Relevant log excerpts (sanitize sensitive data)
6. **Environment Info**: Output of `terraform version` and `make check-tools`

**Example Issue Report**:
```
Environment: development
Command: make apply ENV=development
Error: Error acquiring the state lock

Trying to: Apply database isolation changes
Context: First time running after setup

Terraform version: 1.5.7
Tools status: All tools installed and available

Error details:
[paste complete error message here]
```

---

This troubleshooting guide is a living document. Please update it when you encounter and resolve new issues!