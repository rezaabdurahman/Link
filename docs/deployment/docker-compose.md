# Docker Compose Deployment Guide

This guide covers local development deployment using Docker Compose for the Link platform.

## 🏗️ Local Development Architecture

### Components
- **Docker Compose**: Container orchestration for local development
- **LocalStack**: AWS services simulation for local development
- **PostgreSQL**: Database service
- **Redis**: Caching and session storage
- **All Microservices**: user-svc, api-gateway, chat-svc, ai-svc, discovery-svc, search-svc

### Benefits
- **Fast Setup**: One command to start entire platform
- **Service Isolation**: Work on individual services independently
- **Consistent Environment**: Same setup across all developer machines
- **No Cloud Dependencies**: Everything runs locally

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ (for frontend)
- Go 1.21+ (for backend development)

### Initial Setup (One-time)
```bash
# Clone repository and navigate to backend
cd backend

# Run initial setup
./scripts/dev-workflow.sh setup
```

This script will:
- Set up necessary environment files
- Create Docker networks
- Pull required images
- Initialize LocalStack
- Set up database schemas

### Start All Services
```bash
# Start the entire platform
./scripts/dev-workflow.sh start

# Or manually with docker-compose
cd backend
docker-compose up -d
```

### Start Individual Service
```bash
# Work on specific service only
./scripts/dev-workflow.sh start user-svc

# Or manually
cd backend/user-svc
docker-compose up -d
```

## 📁 Environment Files Structure

```
backend/
├── .env                          # Shared infrastructure (Redis, PostgreSQL)
├── user-svc/
│   ├── .env.local               # Local development secrets
│   ├── docker-compose.yml       # Service-specific compose
│   └── Dockerfile               # Service container definition
├── api-gateway/
│   ├── .env.local
│   ├── docker-compose.yml
│   └── Dockerfile
└── [other-services]/...
```

### Shared Infrastructure (.env)
```env
# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=linkdb
POSTGRES_USER=linkuser
POSTGRES_PASSWORD=linkpass

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redispass

# LocalStack (AWS simulation)
AWS_ENDPOINT=http://localstack:4566
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

### Service-Specific (.env.local)
```env
# user-svc/.env.local
SERVICE_NAME=user-svc
SERVICE_PORT=8081
JWT_SECRET=local-dev-secret-32-chars-minimum
KMS_KEY_ID=alias/link-dev-key

# Enable debug logging
LOG_LEVEL=debug
DEBUG_ENDPOINTS=true
```

## 🛠️ Development Workflow

### Daily Development
```bash
# Start your target service
./scripts/dev-workflow.sh start user-svc

# Make code changes...

# Rebuild and test after changes
./scripts/dev-workflow.sh rebuild user-svc
./scripts/dev-workflow.sh test user-svc

# View service logs  
./scripts/dev-workflow.sh logs user-svc

# View all logs
./scripts/dev-workflow.sh logs
```

### Service Dependencies

Services have the following startup dependencies:
```
1. Infrastructure: postgres, redis, localstack
2. Foundation Services: user-svc (authentication required by others)
3. Core Services: api-gateway, chat-svc, discovery-svc
4. Additional Services: ai-svc, search-svc
```

The dev-workflow script handles these dependencies automatically.

## 🔧 Docker Compose Configuration

### Network Configuration
All services use a shared Docker network for communication:

```yaml
networks:
  link-network:
    external: true
    name: link_default
```

### Service Template Example (user-svc)
```yaml
# backend/user-svc/docker-compose.yml
version: '3.8'
services:
  user-svc:
    build: .
    ports:
      - "8081:8081"
    env_file:
      - ../.env          # Shared infrastructure
      - .env.local       # Service-specific
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8081/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - link-network

networks:
  link-network:
    external: true
```

### Infrastructure Services
```yaml
# backend/docker-compose.yml (infrastructure)
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}

  localstack:
    image: localstack/localstack:latest
    environment:
      SERVICES: kms,secretsmanager
      DEBUG: 1
      DATA_DIR: /tmp/localstack/data
    ports:
      - "4566:4566"
    volumes:
      - localstack_data:/tmp/localstack
```

## 🐛 Troubleshooting

### Common Issues

#### Services Can't Connect to Each Other
```bash
# Check if shared network exists
docker network ls | grep link

# Create network if missing
docker network create link_default

# Restart services
./scripts/dev-workflow.sh restart
```

#### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check database logs
./scripts/dev-workflow.sh logs postgres

# Reset database
docker-compose down -v
./scripts/dev-workflow.sh setup
```

#### LocalStack Not Ready
```bash
# Check LocalStack status
curl http://localhost:4566/health

# Restart LocalStack
docker-compose restart localstack

# Wait for initialization (can take 30-60 seconds)
sleep 60
```

#### Service Won't Start
```bash
# Check service logs for errors
./scripts/dev-workflow.sh logs <service-name>

# Check environment variables
docker exec <container-name> env

# Rebuild from scratch
./scripts/dev-workflow.sh clean <service-name>
./scripts/dev-workflow.sh rebuild <service-name>
```

### Debug Commands
```bash
# Check service status
./scripts/dev-workflow.sh status

# View all service logs
./scripts/dev-workflow.sh logs

# Clean up everything and restart fresh
./scripts/dev-workflow.sh clean
./scripts/dev-workflow.sh setup
```

## 🔍 Service Development

### Adding New Services

1. **Create Service Directory**
   ```bash
   mkdir backend/new-service
   cd backend/new-service
   ```

2. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     new-service:
       build: .
       ports:
         - "8084:8084"
       env_file:
         - ../.env
         - .env.local
       depends_on:
         - postgres
         - redis
       networks:
         - link-network

   networks:
     link-network:
       external: true
   ```

3. **Create Environment File**
   ```bash
   # new-service/.env.local
   SERVICE_NAME=new-service
   SERVICE_PORT=8084
   LOG_LEVEL=debug
   ```

4. **Update dev-workflow.sh**
   Add the new service to the service list in the script.

### Testing Integration
```bash
# Test service communication
docker exec user-svc curl http://api-gateway:8080/health
docker exec api-gateway curl http://user-svc:8081/health

# Test database connectivity
docker exec user-svc psql -h postgres -U linkuser -d linkdb -c "SELECT version();"

# Test Redis connectivity  
docker exec user-svc redis-cli -h redis -p 6379 -a redispass ping
```

## 📊 Performance and Monitoring

### Resource Usage
```bash
# Monitor container resource usage
docker stats

# View specific service logs
./scripts/dev-workflow.sh logs user-svc --tail=100 --follow
```

### Local Metrics
- Health endpoints available at `http://localhost:808X/health`
- Metrics endpoints at `http://localhost:808X/metrics` (if implemented)
- Database accessible at `localhost:5432`
- Redis accessible at `localhost:6379`

## 🔄 Integration with Frontend

### Frontend Development
```bash
# Start backend services
cd backend && ./scripts/dev-workflow.sh start

# Start frontend in separate terminal
cd frontend
npm install
npm run dev
```

### API Testing
```bash
# Test API Gateway (entry point for frontend)
curl http://localhost:8080/api/health

# Test user registration
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","full_name":"Test User"}'
```

## 📚 Best Practices

### ✅ Environment Management
- Use `.env.local` for service-specific configuration
- Keep shared infrastructure in root `.env`
- Never commit secrets or passwords
- Use LocalStack for AWS service simulation

### ✅ Service Design
- Include health checks in all services
- Use meaningful service names and ports
- Implement graceful shutdown handling
- Include proper logging configuration

### ✅ Development Workflow
- Start with infrastructure services first
- Use the dev-workflow script for consistency
- Test service integration regularly
- Keep services stateless where possible

### ✅ Debugging
- Use structured logging for better debugging
- Implement debug endpoints in development
- Monitor resource usage regularly
- Keep container logs accessible