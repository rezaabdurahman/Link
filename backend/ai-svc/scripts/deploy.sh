#!/bin/bash

# AI Service Deployment Script
# Usage: ./scripts/deploy.sh [environment] [options]
# Example: ./scripts/deploy.sh staging --build --monitoring

set -euo pipefail

# Default values
ENVIRONMENT="development"
BUILD_IMAGE=false
PUSH_IMAGE=false
ENABLE_MONITORING=false
ENABLE_LOGGING=false
SKIP_MIGRATION=false
DOCKER_REGISTRY=""
VERSION="latest"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
AI Service Deployment Script

Usage: $0 [environment] [options]

Environments:
  development, dev    Deploy in development mode
  staging, stage      Deploy in staging mode
  production, prod    Deploy in production mode

Options:
  --build             Build Docker image locally
  --push              Push image to registry (requires --build)
  --monitoring        Enable monitoring stack (Prometheus/Grafana)
  --logging           Enable logging stack (Loki/Promtail)
  --skip-migration    Skip database migration
  --registry URL      Docker registry URL
  --version VERSION   Image version/tag (default: latest)
  --help, -h          Show this help message

Examples:
  $0 development
  $0 staging --build --monitoring
  $0 production --push --monitoring --logging --version v1.2.3

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        development|dev)
            ENVIRONMENT="development"
            shift
            ;;
        staging|stage)
            ENVIRONMENT="staging"
            shift
            ;;
        production|prod)
            ENVIRONMENT="production"
            shift
            ;;
        --build)
            BUILD_IMAGE=true
            shift
            ;;
        --push)
            PUSH_IMAGE=true
            shift
            ;;
        --monitoring)
            ENABLE_MONITORING=true
            shift
            ;;
        --logging)
            ENABLE_LOGGING=true
            shift
            ;;
        --skip-migration)
            SKIP_MIGRATION=true
            shift
            ;;
        --registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Must be one of: development, staging, production"
    exit 1
fi

# Set environment-specific configurations
case $ENVIRONMENT in
    development)
        ENV_FILE=".env.development"
        COMPOSE_FILES="-f docker-compose.yml"
        PROFILES="dev"
        ;;
    staging)
        ENV_FILE=".env.staging"
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose.staging.yml"
        PROFILES="staging"
        ;;
    production)
        ENV_FILE=".env.production"
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose.production.yml"
        PROFILES="production"
        ;;
esac

# Add monitoring profile if enabled
if [[ "$ENABLE_MONITORING" == true ]]; then
    PROFILES="$PROFILES,monitoring"
fi

# Add logging profile if enabled (production only)
if [[ "$ENABLE_LOGGING" == true && "$ENVIRONMENT" == "production" ]]; then
    PROFILES="$PROFILES,logging"
elif [[ "$ENABLE_LOGGING" == true && "$ENVIRONMENT" != "production" ]]; then
    print_warning "Logging stack is only available in production environment"
fi

print_header "Deploying AI Service to $ENVIRONMENT environment"

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    print_error "Environment file not found: $ENV_FILE"
    print_error "Please create the environment file or use .env.example as template"
    exit 1
fi

print_status "Using environment file: $ENV_FILE"
print_status "Using profiles: $PROFILES"

# Export environment variables
export ENVIRONMENT
export VERSION
export DOCKER_REGISTRY
export PROFILES

# Build image if requested
if [[ "$BUILD_IMAGE" == true ]]; then
    print_status "Building Docker image..."
    
    if [[ -n "$DOCKER_REGISTRY" ]]; then
        IMAGE_NAME="${DOCKER_REGISTRY}ai-svc:${VERSION}"
    else
        IMAGE_NAME="ai-svc:${VERSION}"
    fi
    
    docker build -t "$IMAGE_NAME" \
        --build-arg VERSION="$VERSION" \
        --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        .
    
    print_status "Image built: $IMAGE_NAME"
    
    # Push image if requested
    if [[ "$PUSH_IMAGE" == true ]]; then
        if [[ -z "$DOCKER_REGISTRY" ]]; then
            print_error "Registry URL required for pushing (use --registry)"
            exit 1
        fi
        
        print_status "Pushing image to registry..."
        docker push "$IMAGE_NAME"
        print_status "Image pushed: $IMAGE_NAME"
    fi
fi

# Validate required secrets for non-development environments
if [[ "$ENVIRONMENT" != "development" ]]; then
    print_status "Validating environment configuration..."
    
    # Source the environment file to check variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check for commented out variables that need values
    if grep -q "^#.*PASSWORD.*=" "$ENV_FILE" || grep -q "^#.*SECRET.*=" "$ENV_FILE" || grep -q "^#.*KEY.*=" "$ENV_FILE"; then
        print_warning "Some sensitive variables are commented out in $ENV_FILE"
        print_warning "Make sure to set proper values for production secrets"
    fi
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" --profile "$PROFILES" down || true

# Pull latest images (for staging/production)
if [[ "$ENVIRONMENT" != "development" ]]; then
    print_status "Pulling latest images..."
    docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" --profile "$PROFILES" pull || true
fi

# Run database migrations (unless skipped)
if [[ "$SKIP_MIGRATION" != true ]]; then
    print_status "Running database migrations..."
    
    # Start only postgres first for migrations
    docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" up -d postgres
    
    # Wait for postgres to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    until docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME"; do
        sleep 2
    done
    
    # Run migrations using the app container
    print_status "Applying database migrations..."
    docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" run --rm ai-svc make migrate || {
        print_warning "Migration failed, but continuing with deployment"
    }
fi

# Deploy services
print_status "Starting services..."
docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" --profile "$PROFILES" up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Health checks
print_status "Performing health checks..."

# Check AI service health
for i in {1..30}; do
    if curl -f -s http://localhost:${SERVER_PORT:-8081}/health > /dev/null 2>&1; then
        print_status "AI Service is healthy"
        break
    else
        if [[ $i -eq 30 ]]; then
            print_error "AI Service health check failed"
            docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" logs ai-svc
            exit 1
        fi
        sleep 2
    fi
done

# Show running services
print_status "Deployment completed successfully!"
print_status "Running services:"
docker-compose $COMPOSE_FILES --env-file "$ENV_FILE" --profile "$PROFILES" ps

# Show access URLs
print_status "Service URLs:"
echo "  AI Service: http://localhost:${SERVER_PORT:-8081}"
echo "  Health Check: http://localhost:${SERVER_PORT:-8081}/health"

if [[ "$ENABLE_MONITORING" == true ]]; then
    echo "  Prometheus: http://localhost:${PROMETHEUS_PORT:-9091}"
    echo "  Grafana: http://localhost:${GRAFANA_PORT:-3001}"
fi

if [[ "$ENVIRONMENT" == "development" ]]; then
    echo "  Redis Commander: http://localhost:${REDIS_COMMANDER_PORT:-8082}"
fi

print_status "Deployment logs can be viewed with:"
echo "  docker-compose $COMPOSE_FILES --env-file $ENV_FILE --profile $PROFILES logs -f"

print_header "Deployment to $ENVIRONMENT completed successfully!"
