#!/bin/bash
# Policy validation with Conftest hook
set -e

echo "📋 Validating policies with Conftest..."

# Check if conftest is installed
if ! command -v conftest &> /dev/null; then
    echo "Installing Conftest..."
    CONFTEST_VERSION="v0.46.0"
    curl -L https://github.com/open-policy-agent/conftest/releases/download/${CONFTEST_VERSION}/conftest_${CONFTEST_VERSION}_$(uname -s)_x86_64.tar.gz | tar xz
    sudo mv conftest /usr/local/bin/
fi

# Create policies directory if it doesn't exist
mkdir -p policies

# Create default security policies if they don't exist
if [ ! -f "policies/security.rego" ]; then
    cat > policies/security.rego << 'EOF'
package main

import rego.v1

# Deny containers running as root
deny contains msg if {
    input.kind == "Deployment"
    input.spec.template.spec.securityContext.runAsUser == 0
    msg := "Container should not run as root user"
}

# Require resource limits
deny contains msg if {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    not container.resources.limits
    msg := sprintf("Container '%s' must have resource limits", [container.name])
}

# Require security context
deny contains msg if {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    not container.securityContext
    msg := sprintf("Container '%s' must have securityContext", [container.name])
}

# Deny privileged containers
deny contains msg if {
    input.kind == "Deployment"
    container := input.spec.template.spec.containers[_]
    container.securityContext.privileged == true
    msg := sprintf("Container '%s' should not run in privileged mode", [container.name])
}
EOF
fi

if [ ! -f "policies/network.rego" ]; then
    cat > policies/network.rego << 'EOF'
package main

import rego.v1

# Require NetworkPolicies for namespaces
warn contains msg if {
    input.kind == "Namespace"
    input.metadata.name != "kube-system"
    input.metadata.name != "default"
    msg := sprintf("Namespace '%s' should have associated NetworkPolicy", [input.metadata.name])
}

# Validate service types
deny contains msg if {
    input.kind == "Service"
    input.spec.type == "NodePort"
    not startswith(input.metadata.namespace, "dev")
    msg := "NodePort services should only be used in development environments"
}
EOF
fi

violations=0

# Run conftest on Kubernetes manifests
if find k8s/ -name "*.yaml" -o -name "*.yml" | head -1 | read; then
    echo "Running Conftest policy validation..."
    
    if find k8s/ -name "*.yaml" -o -name "*.yml" | xargs conftest test --policy policies/; then
        echo "✅ Conftest policy validation passed"
    else
        echo "❌ Conftest policy validation failed"
        violations=$((violations + 1))
    fi
else
    echo "📝 No YAML files found to validate"
fi

if [ $violations -gt 0 ]; then
    echo "❌ Policy validation failed with $violations violations"
    echo "💡 Review the policy violations above and fix the issues"
    exit 1
else
    echo "✅ All policies passed validation"
fi