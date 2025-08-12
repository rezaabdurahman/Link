# Testing & CI/CD Setup

This document describes the testing and CI/CD setup for the chat service.

## Unit Tests

### Service Layer Tests
Located in `internal/service/chat_service_test.go`:
- Tests validation functions with 100% coverage
- Tests service edge cases (same user conversation, empty message IDs)
- Simple mock-free tests focusing on business logic validation
- Run with: `go test ./internal/service`

### Handler Layer Tests  
Located in `internal/handler/`:
- `chat_handler_test.go`: Tests HTTP request validation and parsing
- `health_handler_test.go`: Tests health check endpoints
- Tests JSON parsing, validation logic, and error handling
- Run with: `go test ./internal/handler`

### Running All Tests
```bash
# Run all tests with coverage
go test -v -coverprofile=coverage.out ./internal/service ./internal/handler

# Generate coverage report  
go tool cover -html=coverage.out -o coverage.html

# View coverage by function
go tool cover -func=coverage.out
```

## API Contract Tests

### Postman Collection
- Collection file: `api/chat-svc-api-tests.postman_collection.json`
- Tests all main API endpoints: conversations, messages, health checks
- Includes error scenarios and edge cases
- Uses environment variables for dynamic testing

### Running API Tests with Newman
```bash
# Install Newman globally
npm install -g newman

# Run API tests (service must be running)
./test/run-api-tests.sh

# Run with custom URL
./test/run-api-tests.sh -u https://api.example.com

# Run with custom environment
./test/run-api-tests.sh -e my-env.json -o /tmp/results
```

### Manual Testing with Newman
```bash
# Basic run
newman run api/chat-svc-api-tests.postman_collection.json

# With environment
newman run api/chat-svc-api-tests.postman_collection.json \
  -e test/test-environment.json \
  --reporters cli,html \
  --reporter-html-export results.html
```

## GitHub Actions CI/CD

The CI pipeline is defined in `.github/workflows/ci.yml` and includes:

### Jobs Overview
1. **Lint**: Code quality checks with golangci-lint
2. **Test**: Unit tests with PostgreSQL/Redis, coverage reporting
3. **Integration Test**: API contract tests with Newman
4. **Build**: Multi-platform Docker image builds
5. **Security**: Vulnerability scanning with Trivy
6. **Deploy**: Staging/production deployment triggers
7. **Notify**: Success/failure notifications

### Pipeline Features
- Runs on push/PR to `main` and `develop` branches
- Services: PostgreSQL 14, Redis 7.0
- Coverage reporting to Codecov
- Multi-platform Docker builds (linux/amd64, linux/arm64)
- Security scanning and SARIF upload
- Conditional deployment based on branch

### Required Secrets
- `CODECOV_TOKEN`: For coverage reporting
- `REGISTRY_TOKEN`: For Docker registry access
- `SLACK_WEBHOOK_URL`: For notifications

### Environment Variables
The workflow uses several environment variables:
- `GO_VERSION`: Go version (default: "1.21")
- `DOCKER_REGISTRY`: Docker registry URL
- `IMAGE_NAME`: Docker image name

## Coverage Requirements

The project aims for ≥60% test coverage. Current coverage:
- Service layer: Validation functions have 100% coverage
- Handler layer: Basic request parsing and validation
- Overall: Working toward 60% threshold

## Test Structure

### Service Tests
- Focus on business logic validation
- Mock-free where possible to reduce complexity
- Test edge cases and error conditions
- Comprehensive validation function coverage

### Handler Tests  
- Test HTTP request parsing and validation
- Test error handling and response formatting
- Mock external dependencies minimally
- Focus on request/response contract

### Integration Tests
- Full API contract testing with Newman/Postman
- Test real HTTP endpoints
- Validate request/response formats
- Test error scenarios and edge cases

## Running Tests Locally

### Prerequisites
- Go 1.21+
- Docker and Docker Compose
- Node.js and npm (for Newman)
- PostgreSQL and Redis (or use Docker)

### Development Setup
```bash
# Start dependencies
docker-compose up -d postgres redis

# Run unit tests
make test

# Run with coverage
make test-coverage

# Run API tests (requires running service)
make test-api

# Run all tests
make test-all
```

### Test Data
- Use test fixtures for consistent data
- Clean up test data after each test
- Avoid dependencies between tests
- Use random UUIDs for test isolation

## Continuous Improvement

### Adding New Tests
1. Write unit tests for new service functions
2. Add handler tests for new endpoints  
3. Update Postman collection for new APIs
4. Ensure tests are isolated and deterministic

### Improving Coverage
1. Focus on untested business logic paths
2. Add tests for error conditions
3. Test edge cases and boundary conditions
4. Mock external dependencies appropriately

### Performance Testing
- Consider adding performance tests for critical paths
- Use `go test -bench` for benchmarking
- Monitor test execution time in CI
- Set reasonable timeouts for integration tests
