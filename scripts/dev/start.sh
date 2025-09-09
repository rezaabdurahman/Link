#!/bin/bash
# Development Services Start Script
# Starts Link development services with optional service selection

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

# Parse arguments
SELECTED_SERVICES=()
START_FRONTEND=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only)
            START_FRONTEND=false
            shift
            ;;
        --frontend-only)
            SELECTED_SERVICES=()
            START_FRONTEND=true
            shift
            ;;
        --help|-h)
            cat << EOF
Usage: $0 [OPTIONS] [SERVICES...]

Start Link development services.

OPTIONS:
    --backend-only      Start only backend services
    --frontend-only     Start only frontend
    --help              Show this help

SERVICES:
    Specific services to start: ${SERVICES[*]}
    If no services specified, starts all backend services.

EXAMPLES:
    $0                          # Start all services
    $0 --backend-only           # Start only backend
    $0 user-svc chat-svc        # Start specific services + frontend
    $0 --frontend-only          # Start only frontend
EOF
            exit 0
            ;;
        *)
            if validate_service "$1" 2>/dev/null; then
                SELECTED_SERVICES+=("$1")
            else
                log_warning "Unknown service: $1"
            fi
            shift
            ;;
    esac
done

# If no specific services selected, use all services
if [ ${#SELECTED_SERVICES[@]} -eq 0 ] && [ "$START_FRONTEND" = true ]; then
    SELECTED_SERVICES=("${SERVICES[@]}")
fi

echo -e "${GREEN}🚀 Starting Link Development Services${NC}"
echo "====================================="

# Use existing dev-workflow script if available
if [ -f "$PROJECT_ROOT/backend/scripts/dev-workflow.sh" ]; then
    log_info "Using existing dev-workflow script..."
    
    if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
        # Start specific services
        for service in "${SELECTED_SERVICES[@]}"; do
            log_info "Starting $service..."
            cd "$PROJECT_ROOT/backend"
            ./scripts/dev-workflow.sh start "$service"
        done
    else
        # Start all backend services
        cd "$PROJECT_ROOT/backend"
        ./scripts/dev-workflow.sh start
    fi
else
    # Fallback: use Docker Compose directly
    log_info "Starting backend services with Docker Compose..."
    cd "$PROJECT_ROOT/backend"
    
    if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
        # Start specific services plus dependencies
        COMPOSE_SERVICES=("postgres" "redis" "localstack")
        COMPOSE_SERVICES+=("${SELECTED_SERVICES[@]}")
        docker-compose up -d "${COMPOSE_SERVICES[@]}"
    else
        # Start all services
        docker-compose up -d
    fi
fi

# Start frontend if requested
if [ "$START_FRONTEND" = true ]; then
    log_info "Starting frontend development server..."
    cd "$PROJECT_ROOT/frontend"
    
    # Start frontend in background if not already running
    if ! pgrep -f "vite.*dev" >/dev/null; then
        npm run dev &
        FRONTEND_PID=$!
        log_success "Frontend started (PID: $FRONTEND_PID)"
        
        # Save PID for cleanup
        echo $FRONTEND_PID > "$PROJECT_ROOT/tmp/frontend.pid"
    else
        log_info "Frontend development server already running"
    fi
fi

log_success "Development services started!"
echo ""
log_info "Service Status:"

# Show service status
if [ ${#SELECTED_SERVICES[@]} -gt 0 ]; then
    for service in "${SELECTED_SERVICES[@]}"; do
        local port=$(get_service_port "$service")
        log_info "  - $service: http://localhost:$port"
    done
else
    log_info "  - All backend services started"
fi

if [ "$START_FRONTEND" = true ]; then
    log_info "  - Frontend: http://localhost:3000"
fi

echo ""
log_info "Logs: docker-compose -f backend/docker-compose.yml logs -f"
log_info "Stop: make dev-stop"