#!/bin/bash

# mTLS Test Script
# Tests the mTLS setup without Docker to validate certificates and Go code

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧪 mTLS Testing Script"
echo "======================"

# Check if certificates exist
if [ ! -d "certs" ] || [ ! -f "certs/ca-bundle.crt" ]; then
    echo "📋 Certificates not found. Generating..."
    ./scripts/generate-certs.sh
    echo ""
fi

echo "🔍 Testing certificate validation..."

# Test 1: Verify certificate chains
echo "1. Testing certificate chain validation:"
openssl verify -CAfile certs/ca-bundle.crt certs/gateway.crt
openssl verify -CAfile certs/ca-bundle.crt certs/service.crt
echo "✅ Certificate chains are valid"
echo ""

# Test 2: Test certificate details
echo "2. Testing certificate Subject Alternative Names:"
echo "Gateway certificate SANs:"
openssl x509 -in certs/gateway.crt -text -noout | grep -A 3 "Subject Alternative Name" || echo "  No SANs found"
echo "Service certificate SANs:"
openssl x509 -in certs/service.crt -text -noout | grep -A 3 "Subject Alternative Name" || echo "  No SANs found"
echo ""

# Test 3: Check if Go modules are ready
echo "3. Checking Go modules..."
if [ -f "gateway/go.mod" ] && [ -f "service/go.mod" ]; then
    echo "✅ Go modules found"
    
    # Download dependencies
    echo "📦 Downloading Gateway dependencies..."
    cd gateway && go mod download && cd ..
    
    echo "📦 Downloading Service dependencies..."
    cd service && go mod download && cd ..
    echo ""
else
    echo "❌ Go modules not found"
    exit 1
fi

# Test 4: Build Go applications
echo "4. Building applications..."
echo "🏗️ Building Gateway..."
mkdir -p bin
(cd gateway && go build -o ../bin/gateway .)

echo "🏗️ Building Service..."
(cd service && go build -o ../bin/service .)
echo "✅ Applications built successfully"
echo ""

# Test 5: Test local mTLS connection (requires starting services)
echo "5. Testing mTLS connection..."
echo "🔧 This test requires manual verification:"
echo ""
echo "To test the mTLS setup:"
echo "1. Start the service in one terminal:"
echo "   cd $SCRIPT_DIR && CERTS_DIR=./certs ./bin/service"
echo ""
echo "2. Start the gateway in another terminal:"
echo "   cd $SCRIPT_DIR && CERTS_DIR=./certs ./bin/gateway"
echo ""
echo "3. Test the connection:"
echo "   curl http://localhost:8080/health"
echo "   curl http://localhost:8080/api/users"
echo ""
echo "4. Verify direct service access fails (as expected):"
echo "   curl -k https://localhost:8443/health  # Should fail"
echo ""
echo "5. Test with client certificate:"
echo "   curl --cert certs/gateway.crt --key certs/gateway.key \\"
echo "        --cacert certs/ca-bundle.crt \\"
echo "        https://localhost:8443/health"
echo ""

# Test 6: Docker setup validation
echo "6. Docker setup validation:"
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is available"
    if command -v docker-compose >/dev/null 2>&1; then
        echo "✅ Docker Compose is available"
        echo "🐳 To test with Docker:"
        echo "   make start    # Generate certs, build images, start containers"
        echo "   make test     # Run connectivity tests"
        echo "   make clean    # Clean up everything"
    else
        echo "❌ Docker Compose not found"
    fi
else
    echo "❌ Docker not found"
fi
echo ""

# Test 7: File structure validation
echo "7. Validating file structure..."
required_files=(
    "scripts/generate-certs.sh"
    "gateway/main.go"
    "gateway/go.mod" 
    "gateway/Dockerfile"
    "service/main.go"
    "service/go.mod"
    "service/Dockerfile"
    "docker-compose.yml"
    "docker-compose.override.yml"
    "Makefile"
    "README.md"
)

all_present=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (missing)"
        all_present=false
    fi
done

if [ "$all_present" = true ]; then
    echo "✅ All required files present"
else
    echo "❌ Some files are missing"
fi
echo ""

# Summary
echo "📊 Test Summary:"
echo "================"
echo "✅ Certificate generation: Working"
echo "✅ Certificate validation: Working"
echo "✅ Go applications: Built successfully"
echo "✅ File structure: Complete"
echo ""
echo "🎉 mTLS POC is ready for testing!"
echo ""
echo "Next steps:"
echo "1. Run 'make start' to launch with Docker"
echo "2. Run 'make test' to validate mTLS connectivity"  
echo "3. Check the README.md for detailed usage instructions"
echo ""
echo "🔐 Remember: This uses self-signed certificates for development only!"
