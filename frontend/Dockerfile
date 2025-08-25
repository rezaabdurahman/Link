# Frontend Dockerfile - Multi-stage build for production optimization

# Test stage
FROM node:18-alpine AS test

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for testing)
RUN npm ci

# Copy source code and test environment
COPY . .
COPY .env.test.example .env.test

# Set NODE_ENV for testing
ENV NODE_ENV=test

# Run tests
RUN npm run test

# Dependencies stage for better layer caching
FROM node:18-alpine AS deps
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install all dependencies (including dev deps needed for build)
RUN npm ci --prefer-offline

# Build stage
FROM deps AS builder

# Accept build arguments for environment configuration
ARG NODE_ENV=production
ARG VITE_APP_MODE=production

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV VITE_APP_MODE=${VITE_APP_MODE}

# Copy source code
COPY . .

# Build the application with environment-specific configuration
RUN if [ "$VITE_APP_MODE" = "development" ]; then \
        npm run build:development; \
    elif [ "$VITE_APP_MODE" = "test" ]; then \
        npm run build:test; \
    elif [ "$VITE_APP_MODE" = "staging" ]; then \
        npm run build:staging; \
    elif [ "$VITE_APP_MODE" = "demo" ]; then \
        npm run build:demo; \
    else \
        npm run build:production; \
    fi

# Production stage
FROM nginx:alpine AS production

# Copy custom nginx config (optional - using default for now)
# COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy a simple nginx config for React Router
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
