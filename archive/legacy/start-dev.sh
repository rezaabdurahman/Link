#!/bin/bash

# Link Development Startup Script
# This script starts the full development environment

set -e

echo "🚀 Starting Link Development Environment..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is available
if ! command -v node > /dev/null 2>&1; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is available
if ! command -v npm > /dev/null 2>&1; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Start backend services
echo "🔧 Starting backend services..."
cd backend
docker-compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if API Gateway is responding
for i in {1..30}; do
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ API Gateway is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ API Gateway failed to start. Check logs with: docker-compose logs api-gateway"
        exit 1
    fi
    sleep 2
done

echo "✅ Backend services are ready"
echo ""

# Start frontend
echo "🎨 Starting frontend development server..."
cd ../frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

echo "🌟 Frontend starting at http://localhost:5173"
echo "🔗 API Gateway available at http://localhost:8080"
echo "🗄️  User Service directly available at http://localhost:8081"
echo ""
echo "Press Ctrl+C to stop all services"

# Start frontend in development mode
npm run dev
