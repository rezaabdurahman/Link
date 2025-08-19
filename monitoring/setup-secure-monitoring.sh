#!/bin/bash

# Secure Monitoring Stack Setup Script
set -e

MONITORING_DIR="$(dirname "$0")"
PROJECT_ROOT="$(dirname "$MONITORING_DIR")"

echo "🔒 Setting up secure monitoring stack..."

# Create necessary directories
mkdir -p "$MONITORING_DIR"/{secrets,ssl,nginx}

# Generate secure passwords
echo "📝 Generating secure passwords..."

# Grafana admin password
if [ ! -f "$MONITORING_DIR/secrets/grafana_admin_password.txt" ]; then
    openssl rand -base64 32 > "$MONITORING_DIR/secrets/grafana_admin_password.txt"
    echo "✅ Generated Grafana admin password"
fi

# Redis password (if using Redis auth)
if [ ! -f "$MONITORING_DIR/secrets/redis_password.txt" ]; then
    openssl rand -base64 32 > "$MONITORING_DIR/secrets/redis_password.txt"
    echo "✅ Generated Redis password"
fi

# Database connection string
if [ ! -f "$MONITORING_DIR/secrets/postgres_exporter_dsn.txt" ]; then
    echo "postgresql://monitoring_user:$(openssl rand -base64 16)@postgres:5432/link_app?sslmode=disable" > "$MONITORING_DIR/secrets/postgres_exporter_dsn.txt"
    echo "✅ Generated PostgreSQL DSN"
fi

# Generate Basic Auth for Nginx
echo "🔐 Setting up HTTP Basic Authentication..."
if [ ! -f "$MONITORING_DIR/nginx/htpasswd" ]; then
    # Install htpasswd if not available
    if ! command -v htpasswd &> /dev/null; then
        echo "⚠️  htpasswd not found. Installing..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install httpd
            else
                echo "❌ Please install Apache HTTP Server tools (htpasswd) manually"
                exit 1
            fi
        else
            # Linux
            sudo apt-get update && sudo apt-get install -y apache2-utils || \
            sudo yum install -y httpd-tools || \
            echo "❌ Please install Apache HTTP Server tools (htpasswd) manually"
        fi
    fi

    echo "Enter username for monitoring access:"
    read -r USERNAME
    htpasswd -c "$MONITORING_DIR/nginx/htpasswd" "$USERNAME"
    echo "✅ Created Basic Auth credentials"
fi

# Generate SSL certificates
echo "🔐 Generating SSL certificates..."
if [ ! -f "$MONITORING_DIR/ssl/monitoring.crt" ]; then
    # Create OpenSSL config
    cat > "$MONITORING_DIR/ssl/monitoring.conf" << EOF
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
CN=monitoring.linkapp.local
O=Link App Monitoring
OU=DevOps
L=San Francisco
ST=California
C=US

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = monitoring.linkapp.local
DNS.2 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    # Generate private key
    openssl genrsa -out "$MONITORING_DIR/ssl/monitoring.key" 4096
    
    # Generate certificate
    openssl req -new -x509 -key "$MONITORING_DIR/ssl/monitoring.key" \
        -out "$MONITORING_DIR/ssl/monitoring.crt" \
        -days 365 -config "$MONITORING_DIR/ssl/monitoring.conf" \
        -extensions v3_req

    # Set proper permissions
    chmod 600 "$MONITORING_DIR/ssl/monitoring.key"
    chmod 644 "$MONITORING_DIR/ssl/monitoring.crt"
    
    echo "✅ Generated SSL certificates"
    echo "⚠️  NOTE: These are self-signed certificates for development."
    echo "   For production, use certificates from a trusted CA."
fi

# Set secure file permissions
echo "🔒 Setting secure file permissions..."
chmod 700 "$MONITORING_DIR/secrets"
chmod 600 "$MONITORING_DIR/secrets"/*
chmod 600 "$MONITORING_DIR/nginx/htpasswd"

# Display configuration summary
echo ""
echo "🎉 Secure monitoring stack setup complete!"
echo ""
echo "📋 Summary:"
echo "   - SSL certificates generated for HTTPS"
echo "   - HTTP Basic Authentication configured"
echo "   - Secrets generated and stored securely"
echo "   - File permissions set to secure defaults"
echo ""
echo "To start the secure monitoring stack, run:"
echo "  docker-compose -f monitoring/docker-compose.monitoring.secure.yml up -d"
echo ""
echo "🌐 Access URLs (after startup):"
echo "   - Grafana: https://monitoring.linkapp.local/grafana/"
echo "   - Prometheus: https://monitoring.linkapp.local/prometheus/"
echo "   - Jaeger: https://monitoring.linkapp.local/jaeger/"
echo "   - AlertManager: https://monitoring.linkapp.local/alertmanager/"
echo ""
echo "🔑 Credentials:"
echo "   - HTTP Auth: Check $MONITORING_DIR/nginx/htpasswd"
echo "   - Grafana Admin: Check $MONITORING_DIR/secrets/grafana_admin_password.txt"
echo ""
echo "⚠️  Important Notes:"
echo "   - Add 'monitoring.linkapp.local' to your /etc/hosts file"
echo "   - Accept the self-signed certificate in your browser"
echo "   - Change default passwords before production deployment"
echo "   - Consider using external secrets management in production"
echo ""
