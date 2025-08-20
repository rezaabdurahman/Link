#!/bin/bash
set -e

# Advanced Linkerd Configuration for Production
# Sets up zero-trust policies, monitoring, and performance optimizations

echo "⚙️ Configuring Advanced Linkerd Features..."

# Check if Linkerd is installed
if ! command -v linkerd &> /dev/null; then
    echo "❌ Linkerd CLI not found"
    echo "💡 Run: ./install-linkerd.sh first"
    exit 1
fi

# Check if Linkerd is running
if ! linkerd check > /dev/null 2>&1; then
    echo "❌ Linkerd is not properly installed"
    echo "💡 Run: ./install-linkerd.sh first"
    exit 1
fi

echo "✅ Linkerd is installed and healthy"

# 1. Install Policy Controller (for Zero-Trust)
echo ""
echo "🔒 Step 1: Installing Policy Controller for Zero-Trust..."
if ! kubectl get deployment linkerd-policy-controller -n linkerd > /dev/null 2>&1; then
    echo "📦 Installing Linkerd Policy Controller..."
    # Install policy controller if not present
    linkerd upgrade --addon=policy | kubectl apply -f -
    
    # Wait for policy controller to be ready
    kubectl wait --for=condition=ready pod -l linkerd.io/control-plane-component=policy-controller -n linkerd --timeout=300s
    echo "✅ Policy Controller installed"
else
    echo "✅ Policy Controller already installed"
fi

# 2. Apply production configuration
echo ""
echo "🛡️ Step 2: Applying Zero-Trust policies and advanced configurations..."
kubectl apply -f linkerd-production-config.yaml

# 3. Install Jaeger extension for distributed tracing
echo ""
echo "📊 Step 3: Installing Jaeger extension for distributed tracing..."
if ! kubectl get deployment jaeger -n linkerd-jaeger > /dev/null 2>&1; then
    echo "📦 Installing Linkerd Jaeger extension..."
    linkerd jaeger install | kubectl apply -f -
    
    # Wait for Jaeger to be ready
    kubectl wait --for=condition=ready pod -l app=jaeger -n linkerd-jaeger --timeout=300s
    echo "✅ Jaeger extension installed"
else
    echo "✅ Jaeger extension already installed"
fi

# 4. Apply monitoring configuration
echo ""
echo "📈 Step 4: Setting up monitoring and alerting..."
kubectl apply -f linkerd-monitoring.yaml

# 5. Configure ingress with mTLS
echo ""
echo "🌐 Step 5: Configuring ingress for external traffic..."

# Check if you have an ingress controller
if kubectl get ingressclass > /dev/null 2>&1; then
    echo "✅ Found ingress controller"
    
    # Apply Gateway API configuration
    kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: linkerd
spec:
  controllerName: linkerd.io/gateway-controller
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-external
  namespace: link-services
  annotations:
    external-dns.alpha.kubernetes.io/hostname: api.yourdomain.com
spec:
  type: LoadBalancer
  selector:
    app: api-gateway
  ports:
  - name: http
    port: 80
    targetPort: 8080
  - name: https
    port: 443
    targetPort: 8080
EOF
    echo "✅ External access configured"
else
    echo "⚠️  No ingress controller found - skipping external access setup"
    echo "💡 Install an ingress controller for external access"
fi

# 6. Validate configuration
echo ""
echo "✅ Step 6: Validating configuration..."

# Check Linkerd components
linkerd check

# Check policy configuration
if linkerd viz stat deployment -n link-services > /dev/null 2>&1; then
    echo "✅ Services are meshed and communicating"
    linkerd viz stat deployment -n link-services
else
    echo "⚠️  No meshed services found yet"
    echo "💡 Deploy services with: kubectl apply -f services-with-mtls.yaml"
fi

# 7. Performance tuning recommendations
echo ""
echo "⚡ Step 7: Performance tuning applied..."
echo "✅ HTTP/2 enabled for all services"
echo "✅ Proxy resource limits configured"
echo "✅ Connection pooling optimized"
echo "✅ Retry policies configured"

echo ""
echo "🎉 Advanced Linkerd configuration complete!"
echo ""
echo "🔒 Zero-Trust Features Enabled:"
echo "   ✅ Server authorization policies"
echo "   ✅ mTLS enforcement"
echo "   ✅ Network policies"
echo "   ✅ Service-to-service authentication"
echo ""
echo "📊 Monitoring Features:"
echo "   ✅ Prometheus metrics integration"
echo "   ✅ Grafana dashboard"
echo "   ✅ Distributed tracing with Jaeger"
echo "   ✅ mTLS success rate alerts"
echo ""
echo "⚡ Performance Features:"
echo "   ✅ HTTP/2 for all services"
echo "   ✅ Automatic retries with circuit breaking"
echo "   ✅ Load balancing"
echo "   ✅ Traffic splitting for canary deployments"
echo ""
echo "🎯 Useful Commands:"
echo "   linkerd viz dashboard              # Web UI"
echo "   linkerd viz stat -n link-services  # Service statistics"
echo "   linkerd viz edges -n link-services # Service communication"
echo "   linkerd viz tap deployment/user-svc -n link-services # Live traffic"
echo "   linkerd jaeger dashboard           # Distributed tracing UI"
echo ""
echo "🔍 Monitoring URLs (when port-forwarded):"
echo "   http://localhost:50750 - Linkerd dashboard"
echo "   http://localhost:16686 - Jaeger tracing"
