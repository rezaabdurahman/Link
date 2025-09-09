#!/bin/bash
# Development Environment Setup Script
# One-time setup for Link development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$PROJECT_ROOT/scripts/services.conf"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo -e "${GREEN}🚀 Link Development Environment Setup${NC}"
echo "======================================"

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v docker >/dev/null 2>&1; then
    log_warning "Docker not found. Please install Docker Desktop."
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    log_warning "Node.js not found. Please install Node.js 18+."
    exit 1
fi

if ! command -v go >/dev/null 2>&1; then
    log_warning "Go not found. Please install Go 1.23+."
    exit 1
fi

log_success "Prerequisites check passed"

# Install frontend dependencies
log_info "Installing frontend dependencies..."
cd "$PROJECT_ROOT/frontend"
npm install
log_success "Frontend dependencies installed"

# Install backend dependencies (if applicable)
log_info "Setting up backend services..."
cd "$PROJECT_ROOT/backend"

# Run the existing dev-workflow setup
if [ -f "scripts/dev-workflow.sh" ]; then
    ./scripts/dev-workflow.sh setup
    log_success "Backend setup completed via dev-workflow.sh"
else
    # Fallback setup
    log_info "Running Docker Compose setup..."
    docker-compose pull
    log_success "Backend Docker images pulled"
fi

# Create necessary directories
log_info "Creating necessary directories..."
mkdir -p "$PROJECT_ROOT/logs"
mkdir -p "$PROJECT_ROOT/tmp"
mkdir -p "$PROJECT_ROOT/security_test_results"

# Set up Git hooks (if available)
if [ -f "$PROJECT_ROOT/scripts/setup-pre-commit.sh" ]; then
    log_info "Setting up Git hooks..."
    "$PROJECT_ROOT/scripts/setup-pre-commit.sh"
    log_success "Git hooks configured"
fi

# Generate local secrets (if script exists)
if [ -f "$PROJECT_ROOT/scripts/generate-secrets.sh" ]; then
    log_info "Generating local development secrets..."
    "$PROJECT_ROOT/scripts/generate-secrets.sh" --dev
    log_success "Development secrets generated"
fi

log_success "Development environment setup complete!"
echo ""
log_info "Next steps:"
log_info "1. Run 'make dev-start' to start all services"
log_info "2. Run 'make test' to verify everything is working"
log_info "3. Access the application at http://localhost:3000"