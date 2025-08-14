# mTLS Example Makefile
# Commands to build, run, and test the mTLS demonstration

.PHONY: help certs build up down clean test logs shell-gateway shell-service verify-certs integration-tests test-go test-all test-certs start status

# Default target
help:
	@echo "🔐 mTLS Example Commands:"
	@echo ""
	@echo "Setup:"
	@echo "  make certs       - Generate all certificates (Root CA, Intermediate, Service certs)"
	@echo "  make build       - Build Docker images for gateway and service"
	@echo "  make up          - Start services with mTLS configuration"
	@echo ""
	@echo "Management:"
	@echo "  make down        - Stop and remove containers"
	@echo "  make clean       - Remove containers, images, and certificates"
	@echo "  make logs        - Show logs from all services"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run mTLS connectivity tests"
	@echo "  make verify-certs - Verify certificate chain and validity"
	@echo "  make integration-tests - Run comprehensive integration tests"
	@echo "  make test-go     - Run Go integration tests only"
	@echo ""
	@echo "Development:"
	@echo "  make shell-gateway - Open shell in gateway container"
	@echo "  make shell-service - Open shell in service container"

# Generate certificates using the script
certs:
	@echo "🔐 Generating certificates..."
	@chmod +x scripts/generate-certs.sh
	@./scripts/generate-certs.sh
	@echo "✅ Certificates generated successfully"

# Build Docker images
build:
	@echo "🏗️ Building Docker images..."
	@docker-compose -f docker-compose.yml -f docker-compose.override.yml build
	@echo "✅ Docker images built successfully"

# Start services
up: certs
	@echo "🚀 Starting mTLS services..."
	@docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
	@echo "✅ Services started. Gateway available at http://localhost:8080"
	@echo "🔍 Check logs with: make logs"

# Stop services
down:
	@echo "🛑 Stopping services..."
	@docker-compose -f docker-compose.yml -f docker-compose.override.yml down
	@echo "✅ Services stopped"

# Clean everything
clean: down
	@echo "🧹 Cleaning up..."
	@docker-compose -f docker-compose.yml -f docker-compose.override.yml down -v --remove-orphans
	@docker image rm mtls-gateway:latest mtls-service:latest 2>/dev/null || true
	@docker image prune -f
	@rm -rf certs/
	@echo "✅ Cleanup complete"

# Show logs
logs:
	@echo "📋 Service logs:"
	@docker-compose -f docker-compose.yml -f docker-compose.override.yml logs -f

# Run connectivity tests
test:
	@echo "🧪 Running mTLS connectivity tests..."
	@echo ""
	@echo "Testing Gateway health:"
	@curl -s http://localhost:8080/health | jq '.' 2>/dev/null || curl -s http://localhost:8080/health
	@echo ""
	@echo "Testing API proxy through gateway:"
	@curl -s http://localhost:8080/api/users | jq '.' 2>/dev/null || curl -s http://localhost:8080/api/users
	@echo ""
	@echo "Testing direct service access (should fail without client cert):"
	@curl -k -s https://localhost:8443/health 2>&1 || echo "✅ Direct access blocked - mTLS working!"
	@echo ""
	@echo "Testing with client certificate:"
	@curl --cert certs/gateway.crt --key certs/gateway.key --cacert certs/ca-bundle.crt \
		-s https://localhost:8443/health | jq '.' 2>/dev/null || \
		curl --cert certs/gateway.crt --key certs/gateway.key --cacert certs/ca-bundle.crt \
		-s https://localhost:8443/health

# Verify certificates
verify-certs:
	@echo "🔍 Verifying certificate chain..."
	@if [ ! -f certs/ca-bundle.crt ]; then \
		echo "❌ Certificates not found. Run 'make certs' first."; \
		exit 1; \
	fi
	@echo "Root CA:"
	@openssl x509 -in certs/rootca.crt -text -noout | grep -E "(Subject|Issuer|Not Before|Not After)"
	@echo ""
	@echo "Intermediate CA:"
	@openssl x509 -in certs/intermediate.crt -text -noout | grep -E "(Subject|Issuer|Not Before|Not After)"
	@echo ""
	@echo "Gateway Certificate:"
	@openssl x509 -in certs/gateway.crt -text -noout | grep -E "(Subject|Issuer|Not Before|Not After|DNS|IP Address)"
	@echo ""
	@echo "Service Certificate:"
	@openssl x509 -in certs/service.crt -text -noout | grep -E "(Subject|Issuer|Not Before|Not After|DNS|IP Address)"
	@echo ""
	@echo "Verifying certificate chains:"
	@openssl verify -CAfile certs/ca-bundle.crt certs/gateway.crt
	@openssl verify -CAfile certs/ca-bundle.crt certs/service.crt

# Development shells
shell-gateway:
	@docker exec -it mtls-gateway /bin/sh

shell-service:
	@docker exec -it mtls-service /bin/sh

# Quick start (generates certs, builds, and starts)
start: certs build up

# Status check
status:
	@echo "📊 Service Status:"
	@docker-compose -f docker-compose.yml -f docker-compose.override.yml ps

# Run comprehensive integration tests
integration-tests:
	@echo "🧪 Running comprehensive mTLS integration tests..."
	@chmod +x integration-tests.sh
	@./integration-tests.sh

# Run Go integration tests only
test-go:
	@echo "🧪 Running Go mTLS integration tests..."
	@chmod +x integration-tests.sh
	@./integration-tests.sh go

# Run all tests (legacy + new integration tests)
test-all: test integration-tests
	@echo "✅ All tests completed!"

# Run certificate-only tests
test-certs:
	@echo "🧪 Running certificate validation tests..."
	@chmod +x integration-tests.sh
	@./integration-tests.sh certificates
