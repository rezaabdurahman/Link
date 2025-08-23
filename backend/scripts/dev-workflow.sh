#!/bin/bash
set -e

# Link Application Development Workflow Script
# Best practice microservices development with proper environment management

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Link Application Development Workflow"
echo "========================================"

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to create external network
create_network() {
    if ! docker network ls | grep -q "link-network"; then
        echo "🌐 Creating shared Docker network..."
        docker network create link-network
    else
        echo "✅ Shared Docker network already exists"
    fi
}

# Function to start shared infrastructure
start_infrastructure() {
    echo "🏗️  Starting shared infrastructure..."
    cd "$PROJECT_ROOT"
    
    # Start only shared services from main compose
    docker-compose up -d postgres localstack
    
    echo "⏳ Waiting for infrastructure to be ready..."
    
    # Wait for PostgreSQL
    echo "   - Waiting for PostgreSQL..."
    until docker-compose exec -T postgres pg_isready -U linkuser -d linkdb >/dev/null 2>&1; do
        sleep 2
    done
    
    # Wait for LocalStack
    echo "   - Waiting for LocalStack..."
    until curl -sf http://localhost:4566/_localstack/health >/dev/null 2>&1; do
        sleep 2
    done
    
    echo "✅ Infrastructure ready!"
}

# Function to setup LocalStack KMS
setup_kms() {
    echo "🔐 Setting up LocalStack KMS..."
    "$PROJECT_ROOT/scripts/setup-local-kms.sh"
}

# Function to start a specific service
start_service() {
    local service_name="$1"
    local service_dir="$PROJECT_ROOT/$service_name"
    
    if [[ ! -d "$service_dir" ]]; then
        echo "❌ Service directory not found: $service_dir"
        exit 1
    fi
    
    echo "🚀 Starting $service_name..."
    cd "$service_dir"
    
    if [[ -f "docker-compose.yml" ]]; then
        docker-compose up -d
        echo "✅ $service_name started"
    else
        echo "⚠️  No docker-compose.yml found in $service_dir"
        echo "   Starting from root compose..."
        cd "$PROJECT_ROOT"
        docker-compose up -d "$service_name"
    fi
}

# Function to stop a specific service
stop_service() {
    local service_name="$1"
    local service_dir="$PROJECT_ROOT/$service_name"
    
    echo "⏹️  Stopping $service_name..."
    cd "$service_dir"
    
    if [[ -f "docker-compose.yml" ]]; then
        docker-compose down
    else
        cd "$PROJECT_ROOT"
        docker-compose stop "$service_name"
    fi
    
    echo "✅ $service_name stopped"
}

# Function to show service logs
show_logs() {
    local service_name="$1"
    local service_dir="$PROJECT_ROOT/$service_name"
    
    cd "$service_dir"
    if [[ -f "docker-compose.yml" ]]; then
        docker-compose logs -f
    else
        cd "$PROJECT_ROOT"
        docker-compose logs -f "$service_name"
    fi
}

# Function to run tests for a service
run_tests() {
    local service_name="$1"
    local service_dir="$PROJECT_ROOT/$service_name"
    
    echo "🧪 Running tests for $service_name..."
    cd "$service_dir"
    
    if [[ -f "go.mod" ]]; then
        go test ./... -v
    elif [[ -f "package.json" ]]; then
        npm test
    else
        echo "⚠️  No recognized test framework found"
    fi
}

# Function to rebuild a service
rebuild_service() {
    local service_name="$1"
    
    echo "🔨 Rebuilding $service_name..."
    stop_service "$service_name"
    
    cd "$PROJECT_ROOT"
    docker-compose build "$service_name"
    
    start_service "$service_name"
    echo "✅ $service_name rebuilt and restarted"
}

# Main command handling
case "$1" in
    "setup")
        echo "🔧 Initial setup for Link application development..."
        check_docker
        create_network
        start_infrastructure
        setup_kms
        echo "✅ Setup complete! You can now start individual services."
        ;;
        
    "start")
        service_name="${2:-all}"
        check_docker
        create_network
        
        if [[ "$service_name" == "all" ]]; then
            start_infrastructure
            setup_kms
            # Start all services
            for service in user-svc api-gateway chat-svc discovery-svc ai-svc search-svc; do
                start_service "$service"
            done
        else
            # Ensure infrastructure is running
            if ! docker-compose ps postgres | grep -q "Up"; then
                start_infrastructure
                setup_kms
            fi
            start_service "$service_name"
        fi
        ;;
        
    "stop")
        service_name="${2:-all}"
        if [[ "$service_name" == "all" ]]; then
            cd "$PROJECT_ROOT"
            echo "⏹️  Stopping all services..."
            docker-compose down
            # Also stop service-specific composes
            for service in user-svc api-gateway chat-svc discovery-svc ai-svc search-svc; do
                if [[ -f "$service/docker-compose.yml" ]]; then
                    cd "$PROJECT_ROOT/$service"
                    docker-compose down 2>/dev/null || true
                    cd "$PROJECT_ROOT"
                fi
            done
        else
            stop_service "$service_name"
        fi
        ;;
        
    "logs")
        service_name="${2:-}"
        if [[ -z "$service_name" ]]; then
            cd "$PROJECT_ROOT"
            docker-compose logs -f
        else
            show_logs "$service_name"
        fi
        ;;
        
    "test")
        service_name="${2:-}"
        if [[ -z "$service_name" ]]; then
            echo "❌ Please specify a service to test"
            exit 1
        fi
        run_tests "$service_name"
        ;;
        
    "rebuild")
        service_name="${2:-}"
        if [[ -z "$service_name" ]]; then
            echo "❌ Please specify a service to rebuild"
            exit 1
        fi
        rebuild_service "$service_name"
        ;;
        
    "status")
        echo "📊 Service Status:"
        cd "$PROJECT_ROOT"
        docker-compose ps
        ;;
        
    "clean")
        echo "🧹 Cleaning up Docker resources..."
        cd "$PROJECT_ROOT"
        docker-compose down -v
        docker system prune -f
        docker volume prune -f
        echo "✅ Cleanup complete"
        ;;
        
    *)
        echo "Usage: $0 {setup|start|stop|logs|test|rebuild|status|clean} [service-name]"
        echo ""
        echo "Commands:"
        echo "  setup              - Initial setup (infrastructure + KMS)"
        echo "  start [service]    - Start service(s) or all services"
        echo "  stop [service]     - Stop service(s) or all services"
        echo "  logs [service]     - Show logs for service or all services"
        echo "  test <service>     - Run tests for a specific service"
        echo "  rebuild <service>  - Rebuild and restart a service"
        echo "  status             - Show status of all services"
        echo "  clean              - Clean up all Docker resources"
        echo ""
        echo "Available services:"
        echo "  user-svc, api-gateway, chat-svc, discovery-svc, ai-svc, search-svc"
        echo ""
        echo "Examples:"
        echo "  $0 setup                    # Initial setup"
        echo "  $0 start user-svc          # Start only user service"
        echo "  $0 start                   # Start all services"
        echo "  $0 logs user-svc           # Show user service logs"
        echo "  $0 rebuild api-gateway     # Rebuild API gateway"
        exit 1
        ;;
esac