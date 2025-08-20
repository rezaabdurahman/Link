#!/bin/bash
set -e

# Script to install Linkerd service mesh for automatic mTLS
# This provides zero-config mutual TLS between all services

echo "🚀 Setting up Linkerd Service Mesh for mTLS..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is required but not installed"
    exit 1
fi

# Check if linkerd CLI is available
if ! command -v linkerd &> /dev/null; then
    echo "📦 Installing Linkerd CLI..."
    curl -fsL https://run.linkerd.io/install-stable | sh
    export PATH=$PATH:$HOME/.linkerd2/bin
fi

echo "✅ Linkerd CLI version: $(linkerd version --client --short)"

# 1. Validate cluster readiness
echo "🔍 Checking cluster readiness..."
if ! linkerd check --pre; then
    echo "❌ Cluster is not ready for Linkerd installation"
    echo "💡 Make sure you have a Kubernetes cluster running and kubectl configured"
    exit 1
fi

# 2. Install Gateway API CRDs (required for Linkerd)
echo "📋 Installing Gateway API CRDs..."
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml

# 3. Install Linkerd CRDs
echo "📋 Installing Linkerd CRDs..."
linkerd install --crds | kubectl apply -f -

# 4. Install Linkerd control plane
echo "🎛️ Installing Linkerd control plane..."
linkerd install | kubectl apply -f -

# 5. Wait for control plane to be ready
echo "⏳ Waiting for Linkerd control plane to be ready..."
kubectl wait --for=condition=ready pod -l linkerd.io/control-plane-ns=linkerd -n linkerd --timeout=300s

# 6. Validate installation
echo "✅ Validating Linkerd installation..."
if ! linkerd check; then
    echo "❌ Linkerd installation validation failed"
    exit 1
fi

# 7. Install Linkerd Viz extension for observability
echo "📊 Installing Linkerd Viz extension..."
linkerd viz install | kubectl apply -f -

# 8. Wait for Viz extension to be ready
echo "⏳ Waiting for Linkerd Viz to be ready..."
kubectl wait --for=condition=ready pod -l linkerd.io/extension=viz -n linkerd-viz --timeout=300s

# 9. Validate Viz extension
echo "✅ Validating Linkerd Viz extension..."
linkerd viz check

# 10. Create namespace for Link services
echo "🏗️ Creating link-services namespace..."
kubectl create namespace link-services --dry-run=client -o yaml | kubectl apply -f -

# 11. Inject Linkerd into the namespace (automatic mTLS)
echo "🔒 Enabling automatic mTLS for link-services namespace..."
kubectl annotate namespace link-services linkerd.io/inject=enabled --overwrite

echo ""
echo "🎉 Linkerd installation complete!"
echo ""
echo "📋 What was installed:"
echo "  ✅ Linkerd control plane with automatic mTLS"
echo "  ✅ Linkerd Viz extension for observability" 
echo "  ✅ Gateway API CRDs"
echo "  ✅ link-services namespace with auto-injection"
echo ""
echo "🔒 Security features enabled:"
echo "  ✅ Automatic mutual TLS between all services"
echo "  ✅ Zero-config certificate rotation"
echo "  ✅ Traffic encryption and authentication"
echo "  ✅ Policy enforcement capabilities"
echo ""
echo "📊 Next steps:"
echo "  1. Deploy your services to the 'link-services' namespace"
echo "  2. Run: linkerd viz dashboard (for GUI observability)"
echo "  3. Run: linkerd viz stat deployment -n link-services (to see mTLS status)"
echo "  4. Run: linkerd viz edges -n link-services (to see service communication)"
echo ""
echo "🔍 Useful commands:"
echo "  linkerd check                    # Validate installation"
echo "  linkerd viz top -n link-services # Live traffic view"
echo "  linkerd viz stat -n link-services # Service statistics"
echo "  linkerd viz edges -n link-services # Service communication graph"
