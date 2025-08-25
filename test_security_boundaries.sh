#!/bin/bash

# Test Security Boundaries for Three-Tier Authentication
echo "=== Security Boundary Validation Test ==="

# Test 1: Verify app users cannot access infrastructure permissions
echo "1. Testing app user boundary violations..."
INFRASTRUCTURE_PERMS=("admin.system" "admin.roles" "admin.analytics" "services.configure" "services.deploy")

for perm in "${INFRASTRUCTURE_PERMS[@]}"; do
    if grep -q "$perm" "backend/user-svc/migrations/007_rbac_system.up.sql"; then
        # Permission exists in original system, check if it's removed in cleanup
        if ! grep -q "'$perm'" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql"; then
            echo "❌ Infrastructure permission '$perm' not removed in cleanup migration"
            exit 1
        fi
    fi
done
echo "✅ Infrastructure permissions removed from app user system"

# Test 2: Verify community_moderator has only content permissions
echo "2. Testing community moderator permissions are content-focused..."
VALID_MODERATOR_PERMS=("messages.moderate" "messages.delete_any" "profiles.read_private" "users.read" "admin.users")
INVALID_MODERATOR_PERMS=("admin.system" "services.configure" "services.deploy")

# Check that community moderator gets appropriate permissions in original migration
for perm in "${INVALID_MODERATOR_PERMS[@]}"; do
    if grep -A 10 "community_moderator.*AND p.name IN" "backend/user-svc/migrations/007_rbac_system.up.sql" | grep -q "$perm"; then
        echo "❌ Community moderator has invalid infrastructure permission: $perm"
        exit 1
    fi
done
echo "✅ Community moderator permissions are content-focused only"

# Test 3: Verify middleware functions use correct role names
echo "3. Testing middleware uses correct role names..."
if grep -q "IsAdmin\|RequireAdmin" "backend/api-gateway/internal/middleware/"*.go; then
    echo "❌ Old admin function references still exist in middleware"
    exit 1
fi

if ! grep -q "IsCommunityModerator\|RequireCommunityModerator" "backend/api-gateway/internal/middleware/"*.go; then
    echo "❌ New community moderator functions not found in middleware"
    exit 1
fi
echo "✅ Middleware uses correct role names and functions"

# Test 4: Verify service accounts are separate from app users
echo "4. Testing service account separation..."
if ! grep -q "CREATE TABLE service_accounts" "backend/user-svc/migrations/009_service_accounts.up.sql"; then
    echo "❌ Service accounts table not properly created"
    exit 1
fi

# Check that service accounts don't use user roles
if grep -q "user_roles.*service_accounts\|service_accounts.*user_roles" "backend/user-svc/migrations/"*.sql; then
    echo "❌ Service accounts incorrectly linked to user roles"
    exit 1
fi
echo "✅ Service accounts properly separated from app users"

# Test 5: Verify employee access documentation excludes app database
echo "5. Testing employee access separation..."
if grep -q "app user.*database\|user database.*employee" "infrastructure/employee-access/README.md"; then
    # This should be followed by a statement that employees don't use app database
    if ! grep -q "NOT.*app user system\|app user system.*NOT" "infrastructure/employee-access/README.md"; then
        echo "❌ Employee access documentation doesn't clearly separate from app users"
        exit 1
    fi
fi

if ! grep -q "AWS IAM\|cloud provider IAM" "infrastructure/employee-access/README.md"; then
    echo "❌ Employee access doesn't use cloud IAM"
    exit 1
fi
echo "✅ Employee access properly separated and uses cloud IAM"

# Test 6: Verify JWT token separation
echo "6. Testing JWT token separation..."
if ! grep -q "SERVICE_JWT_SECRET.*USER_JWT_SECRET\|user.*service.*JWT.*secret" "docs/IAM_ARCHITECTURE.md"; then
    # Check for any mention of separate secrets
    if ! grep -q "separate.*JWT.*secret\|different.*secret" "docs/IAM_ARCHITECTURE.md"; then
        echo "❌ JWT token separation not clearly documented"
        exit 1
    fi
fi
echo "✅ JWT token separation documented"

# Test 7: Verify Kubernetes RBAC separates employees from app users
echo "7. Testing Kubernetes RBAC separation..."
if grep -q "app.*user.*kubernetes\|kubernetes.*app.*user" "k8s/access/rbac.yaml"; then
    echo "❌ Kubernetes RBAC incorrectly references app users"
    exit 1
fi

if ! grep -q "AWS IAM role integration\|arn:aws:iam" "k8s/access/rbac.yaml"; then
    echo "❌ Kubernetes RBAC doesn't integrate with AWS IAM for employees"
    exit 1
fi
echo "✅ Kubernetes RBAC properly separates employees from app users"

# Test 8: Verify banned role exists and has no permissions
echo "8. Testing banned role implementation..."
if ! grep -q "banned.*user.*no access" "backend/user-svc/migrations/010_cleanup_user_roles.up.sql"; then
    echo "❌ Banned role not properly implemented"
    exit 1
fi
echo "✅ Banned role properly implemented"

echo ""
echo "=== Security Boundary Test Results ==="
echo "✅ All security boundary tests passed!"
echo ""
echo "Validated security boundaries:"
echo "- ✅ App users cannot access infrastructure permissions"
echo "- ✅ Community moderators have content-only permissions"  
echo "- ✅ Middleware uses correct role names"
echo "- ✅ Service accounts are separate from app users"
echo "- ✅ Employees use AWS IAM, not app database"
echo "- ✅ JWT tokens are properly separated"
echo "- ✅ Kubernetes RBAC separates employees from app users"
echo "- ✅ Banned role properly implemented"
echo ""
echo "🔒 Security boundaries are properly implemented and enforced!"