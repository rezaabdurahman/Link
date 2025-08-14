#!/bin/bash

# Certificate generation script for mTLS setup
# Creates: Root CA -> Intermediate CA -> Service certificates
# Usage: ./generate-certs.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/../certs"

# Create certs directory
mkdir -p "$CERTS_DIR"

echo "🔐 Generating certificates for mTLS setup..."

# Function to generate a configuration file for certificates
generate_config() {
    local name="$1"
    local type="$2"
    local alt_names="$3"
    
    if [ "$type" = "ca" ]; then
        # Root CA configuration
        cat > "$CERTS_DIR/${name}.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_ca
prompt = no

[req_distinguished_name]
C = US
ST = CA
L = San Francisco
O = Example Corp
OU = Security Team
CN = $name

[v3_ca]
basicConstraints = CA:TRUE, pathlen:1
keyUsage = cRLSign, keyCertSign
subjectKeyIdentifier = hash
EOF
    elif [ "$type" = "intermediate" ]; then
        # Intermediate CA configuration  
        cat > "$CERTS_DIR/${name}.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_intermediate_ca
prompt = no

[req_distinguished_name]
C = US
ST = CA
L = San Francisco
O = Example Corp
OU = Security Team
CN = $name

[v3_intermediate_ca]
basicConstraints = CA:TRUE, pathlen:0
keyUsage = cRLSign, keyCertSign
subjectKeyIdentifier = hash
EOF
    else
        # Service certificate configuration
        cat > "$CERTS_DIR/${name}.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = CA
L = San Francisco
O = Example Corp
OU = Security Team
CN = $name

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth, clientAuth
basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
EOF
        
        if [ -n "$alt_names" ]; then
            cat >> "$CERTS_DIR/${name}.conf" << EOF
subjectAltName = @alt_names

[alt_names]
$alt_names
EOF
        fi
    fi
}

# 1. Generate Root CA
echo "📋 Step 1: Generating Root CA..."
generate_config "rootca" "ca"

# Generate root CA private key
openssl genrsa -out "$CERTS_DIR/rootca.key" 4096

# Generate root CA certificate
openssl req -new -x509 -key "$CERTS_DIR/rootca.key" \
    -out "$CERTS_DIR/rootca.crt" \
    -config "$CERTS_DIR/rootca.conf" \
    -days 3650 \
    -extensions v3_ca

echo "✅ Root CA generated: rootca.crt, rootca.key"

# 2. Generate Intermediate CA
echo "📋 Step 2: Generating Intermediate CA..."
generate_config "intermediate" "intermediate"

# Generate intermediate CA private key
openssl genrsa -out "$CERTS_DIR/intermediate.key" 4096

# Generate intermediate CA certificate signing request
openssl req -new -key "$CERTS_DIR/intermediate.key" \
    -out "$CERTS_DIR/intermediate.csr" \
    -config "$CERTS_DIR/intermediate.conf"

# Sign intermediate CA certificate with root CA
openssl x509 -req -in "$CERTS_DIR/intermediate.csr" \
    -CA "$CERTS_DIR/rootca.crt" \
    -CAkey "$CERTS_DIR/rootca.key" \
    -CAcreateserial \
    -out "$CERTS_DIR/intermediate.crt" \
    -days 1825 \
    -extensions v3_intermediate_ca \
    -extfile "$CERTS_DIR/intermediate.conf"

echo "✅ Intermediate CA generated: intermediate.crt, intermediate.key"

# 3. Generate Gateway certificate
echo "📋 Step 3: Generating Gateway certificate..."
generate_config "gateway" "service" "DNS.1 = gateway\nDNS.2 = localhost\nIP.1 = 127.0.0.1"

# Generate gateway private key
openssl genrsa -out "$CERTS_DIR/gateway.key" 2048

# Generate gateway certificate signing request
openssl req -new -key "$CERTS_DIR/gateway.key" \
    -out "$CERTS_DIR/gateway.csr" \
    -config "$CERTS_DIR/gateway.conf"

# Sign gateway certificate with intermediate CA
openssl x509 -req -in "$CERTS_DIR/gateway.csr" \
    -CA "$CERTS_DIR/intermediate.crt" \
    -CAkey "$CERTS_DIR/intermediate.key" \
    -CAcreateserial \
    -out "$CERTS_DIR/gateway.crt" \
    -days 365 \
    -extensions v3_req \
    -extfile "$CERTS_DIR/gateway.conf"

echo "✅ Gateway certificate generated: gateway.crt, gateway.key"

# 4. Generate Service certificate
echo "📋 Step 4: Generating Service certificate..."
generate_config "service" "service" "DNS.1 = service\nDNS.2 = localhost\nIP.1 = 127.0.0.1"

# Generate service private key
openssl genrsa -out "$CERTS_DIR/service.key" 2048

# Generate service certificate signing request
openssl req -new -key "$CERTS_DIR/service.key" \
    -out "$CERTS_DIR/service.csr" \
    -config "$CERTS_DIR/service.conf"

# Sign service certificate with intermediate CA
openssl x509 -req -in "$CERTS_DIR/service.csr" \
    -CA "$CERTS_DIR/intermediate.crt" \
    -CAkey "$CERTS_DIR/intermediate.key" \
    -CAcreateserial \
    -out "$CERTS_DIR/service.crt" \
    -days 365 \
    -extensions v3_req \
    -extfile "$CERTS_DIR/service.conf"

echo "✅ Service certificate generated: service.crt, service.key"

# 5. Create certificate chain files
echo "📋 Step 5: Creating certificate chains..."

# Create full chain for gateway (cert + intermediate + root)
cat "$CERTS_DIR/gateway.crt" "$CERTS_DIR/intermediate.crt" "$CERTS_DIR/rootca.crt" > "$CERTS_DIR/gateway-chain.crt"

# Create full chain for service (cert + intermediate + root)
cat "$CERTS_DIR/service.crt" "$CERTS_DIR/intermediate.crt" "$CERTS_DIR/rootca.crt" > "$CERTS_DIR/service-chain.crt"

# Create CA bundle (intermediate + root)
cat "$CERTS_DIR/intermediate.crt" "$CERTS_DIR/rootca.crt" > "$CERTS_DIR/ca-bundle.crt"

echo "✅ Certificate chains created"

# 6. Set appropriate permissions
chmod 600 "$CERTS_DIR"/*.key
chmod 644 "$CERTS_DIR"/*.crt

# 7. Verify certificates
echo "📋 Step 6: Verifying certificates..."

echo "🔍 Root CA info:"
openssl x509 -in "$CERTS_DIR/rootca.crt" -text -noout | grep -E "(Subject|Issuer|Not Before|Not After)"

echo "🔍 Intermediate CA info:"
openssl x509 -in "$CERTS_DIR/intermediate.crt" -text -noout | grep -E "(Subject|Issuer|Not Before|Not After)"

echo "🔍 Gateway certificate info:"
openssl x509 -in "$CERTS_DIR/gateway.crt" -text -noout | grep -E "(Subject|Issuer|Not Before|Not After|DNS|IP Address)"

echo "🔍 Service certificate info:"
openssl x509 -in "$CERTS_DIR/service.crt" -text -noout | grep -E "(Subject|Issuer|Not Before|Not After|DNS|IP Address)"

# Verify certificate chains
echo "🔍 Verifying certificate chains..."
openssl verify -CAfile "$CERTS_DIR/ca-bundle.crt" "$CERTS_DIR/gateway.crt"
openssl verify -CAfile "$CERTS_DIR/ca-bundle.crt" "$CERTS_DIR/service.crt"

# Clean up temporary files
rm -f "$CERTS_DIR"/*.conf "$CERTS_DIR"/*.csr "$CERTS_DIR"/*.srl

echo ""
echo "🎉 Certificate generation complete!"
echo "📁 Certificates generated in: $CERTS_DIR"
echo ""
echo "Generated files:"
echo "  📜 Root CA: rootca.crt, rootca.key"
echo "  📜 Intermediate CA: intermediate.crt, intermediate.key"
echo "  📜 Gateway: gateway.crt, gateway.key, gateway-chain.crt"
echo "  📜 Service: service.crt, service.key, service-chain.crt"
echo "  📜 CA Bundle: ca-bundle.crt"
echo ""
echo "🚨 Note: These are self-signed certificates for development only!"
echo "🔒 Private keys have been secured with 600 permissions"
