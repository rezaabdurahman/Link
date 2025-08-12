#!/bin/sh

# Docker entrypoint script for discovery-svc
# This script runs migrations before starting the main service

set -e

echo "=== Discovery Service Entrypoint ==="

# Wait for database to be ready (simple check)
echo "Waiting for database to be ready..."
until nc -z "${DB_HOST:-postgres}" "${DB_PORT:-5432}"; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
./migrate -action=up

if [ $? -eq 0 ]; then
    echo "Migrations completed successfully"
else
    echo "Migrations failed, exiting..."
    exit 1
fi

# Start the main service
echo "Starting discovery service..."
exec ./discovery-svc
