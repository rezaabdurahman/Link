#!/bin/bash
# Kubernetes manifest validation hook
set -e

echo "🔍 Validating Kubernetes manifests..."

# Check if kubeval is installed
if ! command -v kubeval &> /dev/null; then
    echo "Installing kubeval..."
    curl -L https://github.com/instrumenta/kubeval/releases/latest/download/kubeval-$(uname -s | tr '[:upper:]' '[:lower:]')-amd64.tar.gz | tar xz
    sudo mv kubeval /usr/local/bin/
fi

# Check if kubeconform is installed
if ! command -v kubeconform &> /dev/null; then
    echo "Installing kubeconform..."
    curl -L https://github.com/yannh/kubeconform/releases/download/v0.6.4/kubeconform-$(uname -s | tr '[:upper:]' '[:lower:]')-amd64.tar.gz | tar xz
    sudo mv kubeconform /usr/local/bin/
fi

violations=0

# Validate with kubeval
echo "Running kubeval validation..."
if find k8s/ -name "*.yaml" -o -name "*.yml" | xargs kubeval; then
    echo "✅ kubeval validation passed"
else
    echo "❌ kubeval validation failed"
    violations=$((violations + 1))
fi

# Validate with kubeconform
echo "Running kubeconform validation..."
if find k8s/ -name "*.yaml" -o -name "*.yml" | xargs kubeconform -strict -summary; then
    echo "✅ kubeconform validation passed"
else
    echo "❌ kubeconform validation failed"
    violations=$((violations + 1))
fi

if [ $violations -gt 0 ]; then
    echo "❌ Kubernetes manifest validation failed with $violations violations"
    exit 1
else
    echo "✅ All Kubernetes manifests are valid"
fi