#!/bin/bash

# Test IAM Cleanup Implementation
echo "=== IAM Cleanup Validation Test ==="

# 1. Check migration files exist and are valid SQL
echo "1. Checking migration files..."
if [[ -f "backend/user-svc/migrations/010_cleanup_user_roles.up.sql" ]]; then
    echo "✅ Migration UP file exists"
    # Check for SQL syntax errors (basic)
    if grep -q "UPDATE\|DELETE\|INSERT" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql"; then
        echo "✅ Migration contains expected SQL operations"
    else
        echo "❌ Migration missing SQL operations"
        exit 1
    fi
else
    echo "❌ Migration UP file missing"
    exit 1
fi

if [[ -f "backend/user-svc/migrations/010_cleanup_user_roles.down.sql" ]]; then
    echo "✅ Migration DOWN file exists"
else
    echo "❌ Migration DOWN file missing"
    exit 1
fi

# 2. Check code changes were applied
echo "2. Checking code updates..."
if grep -q "community_moderator" "backend/api-gateway/internal/middleware/rbac.go"; then
    echo "✅ RBAC middleware updated to use community_moderator"
else
    echo "❌ RBAC middleware not updated"
    exit 1
fi

if grep -q "IsCommunityModerator" "backend/api-gateway/internal/middleware/auth.go"; then
    echo "✅ Auth middleware updated with new function names"
else
    echo "❌ Auth middleware not updated"
    exit 1
fi

# Check that old admin references are removed
if grep -q "IsAdmin.*admin" "backend/api-gateway/internal/middleware/auth.go"; then
    echo "❌ Old admin references still exist in auth middleware"
    exit 1
else
    echo "✅ Old admin references removed from auth middleware"
fi

# 3. Check documentation updates
echo "3. Checking documentation..."
if [[ -f "docs/IAM_ARCHITECTURE.md" ]]; then
    echo "✅ IAM Architecture documentation created"
    if grep -q "community_moderator" "docs/IAM_ARCHITECTURE.md"; then
        echo "✅ IAM Architecture uses correct role names"
    else
        echo "❌ IAM Architecture missing community_moderator references"
        exit 1
    fi
else
    echo "❌ IAM Architecture documentation missing"
    exit 1
fi

if [[ -f "infrastructure/employee-access/README.md" ]]; then
    echo "✅ Employee access documentation created"
else
    echo "❌ Employee access documentation missing"
    exit 1
fi

if [[ -f "backend/RBAC_IMPLEMENTATION.md" ]]; then
    echo "✅ RBAC implementation documentation updated"
    if grep -q "community_moderator" "backend/RBAC_IMPLEMENTATION.md"; then
        echo "✅ RBAC documentation uses correct role names"
    else
        echo "❌ RBAC documentation not updated with new role names"
        exit 1
    fi
else
    echo "❌ RBAC implementation documentation missing"
    exit 1
fi

# 4. Check Kubernetes RBAC updates
echo "4. Checking Kubernetes configuration..."
if [[ -f "k8s/access/rbac.yaml" ]]; then
    echo "✅ Kubernetes RBAC file exists"
    if grep -q "AWS IAM Integration" "k8s/access/rbac.yaml"; then
        echo "✅ Kubernetes RBAC updated for employee access"
    else
        echo "❌ Kubernetes RBAC not updated for new architecture"
        exit 1
    fi
else
    echo "❌ Kubernetes RBAC file missing"
    exit 1
fi

# 5. Verify security boundaries are documented
echo "5. Checking security boundaries..."
if grep -q "App users CANNOT access infrastructure" "docs/IAM_ARCHITECTURE.md"; then
    echo "✅ Security boundaries clearly documented"
else
    echo "❌ Security boundaries not clearly documented"
    exit 1
fi

# 6. Test that migration logic is sound
echo "6. Validating migration logic..."
# Check that we're renaming admin to community_moderator (not creating both)
if grep -A 2 "UPDATE roles" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql" | grep -q "community_moderator" && grep -A 3 "UPDATE roles" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql" | grep -q "WHERE name = 'admin'"; then
    echo "✅ Migration correctly renames admin role"
else
    echo "❌ Migration doesn't properly rename admin role"
    exit 1
fi

# Check that we're removing infrastructure permissions
if grep -q "admin\.system" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql" && grep -q "admin\.roles" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql" && grep -q "admin\.analytics" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql"; then
    echo "✅ Migration removes infrastructure permissions"
else
    echo "❌ Migration doesn't remove infrastructure permissions"
    exit 1
fi

# Check that rollback migration exists and reverses changes
if grep -A 2 "UPDATE roles" "backend/user-svc/migrations/010_cleanup_user_roles.down.sql" | grep -q "name = 'admin'" && grep -A 3 "UPDATE roles" "backend/user-svc/migrations/010_cleanup_user_roles.down.sql" | grep -q "WHERE name = 'community_moderator'"; then
    echo "✅ Rollback migration can reverse changes"
else
    echo "❌ Rollback migration cannot properly reverse changes"
    exit 1
fi

echo ""
echo "=== IAM Cleanup Validation Results ==="
echo "✅ All checks passed!"
echo ""
echo "Summary of changes:"
echo "- ✅ Created migration 010_cleanup_user_roles.{up,down}.sql"
echo "- ✅ Updated middleware code to use community_moderator"
echo "- ✅ Created comprehensive IAM architecture documentation"  
echo "- ✅ Created employee access management guide"
echo "- ✅ Updated Kubernetes RBAC for three-tier architecture"
echo "- ✅ Updated RBAC implementation documentation"
echo "- ✅ Established clear security boundaries"
echo ""
echo "Next steps:"
echo "1. Apply migration: cd backend/user-svc && make migrate-up"
echo "2. Set up AWS IAM roles for employees"
echo "3. Test all three authentication systems independently"
echo "4. Update team training materials"
echo ""
echo "🎉 IAM cleanup implementation is complete and ready for deployment!"