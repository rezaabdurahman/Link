# Local Development Setup

## Quick Start with PII Encryption

### 1. Start Services
```bash
# Start all services including LocalStack for KMS
docker-compose up -d

# Wait for services to be ready (about 30s)
docker-compose logs -f localstack  # Wait for "Ready" message
```

### 2. Setup Local KMS
```bash
# One-time setup - creates local KMS key for encryption
./scripts/setup-local-kms.sh
```

### 3. Verify Everything Works
```bash
# Check all services are healthy
docker-compose ps

# Test user service with encryption
curl -X POST http://localhost:8081/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "first_name": "Test",
    "last_name": "User",
    "password": "password123"
  }'
```

## What's Happening Behind the Scenes

### Services Running:
- **PostgreSQL**: Database storage
- **Redis**: Multiple instances for caching
- **LocalStack**: Mock AWS KMS for encryption
- **All microservices**: user-svc, chat-svc, etc.

### PII Encryption:
- **User emails, names, bio, location** are automatically encrypted
- **Session tokens** are encrypted in database
- **Social links and interests** are encrypted
- Uses **AES-256-GCM** with **envelope encryption**
- **LocalStack KMS** manages encryption keys (no real AWS needed)

### Database Schema:
```sql
-- All PII fields store encrypted data as text
users.email          -- Encrypted email
users.first_name     -- Encrypted first name  
users.last_name      -- Encrypted last name
users.bio            -- Encrypted bio (optional)
users.location       -- Encrypted location (optional)
sessions.token        -- Encrypted session token
```

## Development Workflow

### Making Changes
```bash
# Rebuild specific service after code changes
docker-compose up --build user-svc

# View logs
docker-compose logs -f user-svc

# Run tests with local encryption
cd user-svc && go test ./internal/security/ -v
```

### Debugging Encryption
```bash
# Check LocalStack KMS is working
curl http://localhost:4566/_localstack/health

# View encrypted data in database
docker exec -it link_postgres psql -U linkuser -d linkdb
linkdb=# SELECT email, first_name FROM users LIMIT 1;
# Should show encrypted strings, not readable text

# View decrypted data via API
curl http://localhost:8081/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should show readable user data
```

### Environment Variables (Already Set)
```bash
# LocalStack KMS configuration (in docker-compose.yml)
AWS_KMS_ENDPOINT=http://localstack:4566
AWS_KMS_KEY_ID=alias/link-app-pii-encryption
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

## Troubleshooting

### LocalStack Not Starting
```bash
# Check LocalStack logs
docker-compose logs localstack

# Restart LocalStack
docker-compose restart localstack
```

### KMS Key Not Found
```bash
# Re-run the setup script
./scripts/setup-local-kms.sh

# Or manually create the key
aws --endpoint-url=http://localhost:4566 \
    --region us-west-2 \
    kms create-key --description "Dev key"
```

### User Service Failing to Start
```bash
# Check user-svc logs
docker-compose logs user-svc

# Common issues:
# 1. LocalStack not ready -> wait and restart user-svc
# 2. KMS key missing -> run setup script
# 3. Database not ready -> check postgres logs
```

### Testing Without Encryption (Emergency)
```bash
# Add this to user-svc environment in docker-compose.yml
ENCRYPTION_DISABLED=true

# Then restart
docker-compose up --build user-svc
```

## Benefits of This Setup

✅ **No AWS Account Required** - Everything runs locally  
✅ **Identical to Production** - Same encryption behavior  
✅ **Fast Development** - Instant encryption testing  
✅ **Secure by Default** - All PII encrypted from day one  
✅ **Easy Debugging** - Local KMS with debug logging  

You can now develop with full PII encryption without any external dependencies!