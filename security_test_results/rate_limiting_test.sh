#!/bin/bash
# Rate limiting test - 20 rapid requests
for i in {1..20}; do
  echo "Request $i:"
  curl -s -w "HTTP %{http_code}\n" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}' \
    "http://localhost:8080/api/auth/login"
done
