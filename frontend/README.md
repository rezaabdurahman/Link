# Link Frontend

Connect with people around you - AI-powered iOS-style frontend for real-life connections.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page-level components
├── hooks/         # Custom React hooks
├── types/         # TypeScript type definitions
├── config/        # Configuration files
├── data/          # Static data and mock data
└── __tests__/     # Test files
```

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Jest** for testing
- **ESLint** for code quality

## Development Guidelines

- Use TypeScript strict mode
- Follow ESLint rules
- Write tests for new features
- Use semantic commit messages
- Maintain 80%+ code coverage

## Environment Variables

The application uses environment variables to configure different deployment modes and maintain environment parity across development, CI, and Docker environments.

### Environment Files

The following environment files are used:
- `.env.demo` - Demo environment configuration (committed to git)
- `.env.preview` - Preview/staging environment configuration (committed to git)
- `.env.production` - Production environment configuration (committed to git)
- `.env.test` - Test environment configuration (git-ignored, create locally)
- `.env.local` - Local overrides (git-ignored)

### Required Variables

All environments must define the following variables:

#### Core Configuration
- `NODE_ENV` - Environment mode (development, test, production)
- `VITE_APP_MODE` - Application mode (demo, preview, production, test)

#### API Configuration
- `VITE_API_BASE_URL` - Base URL for API requests
- `VITE_API_URL` - Full API endpoint URL

#### Authentication & User Settings
- `VITE_REQUIRE_AUTH` - Whether authentication is required (true/false)
- `VITE_AUTO_LOGIN` - Enable automatic login (true/false)
- `VITE_MOCK_USER` - Use mock user data (true/false)

#### Demo Mode Settings
- `VITE_SHOW_DEMO_BANNER` - Display demo banner (true/false)
- `VITE_DEMO_BANNER_TEXT` - Text for demo banner
- `VITE_SEED_DEMO_DATA` - Seed with demo data (true/false)

#### Development & Testing
- `VITE_ENABLE_MOCKING` - Enable API mocking (true/false)

### Environment Setup

#### For Local Development
1. Copy one of the existing environment files as a template
2. Create `.env.local` for local overrides
3. Configure variables as needed

#### For Testing
1. Create `.env.test` based on the template below:
```bash
# Test Environment Configuration
NODE_ENV=test
VITE_APP_MODE=test
VITE_REQUIRE_AUTH=false
VITE_AUTO_LOGIN=false
VITE_MOCK_USER=true
VITE_SHOW_DEMO_BANNER=false
VITE_DEMO_BANNER_TEXT=
VITE_SEED_DEMO_DATA=false
VITE_API_BASE_URL=http://localhost:8080
VITE_API_URL=http://localhost:8080
VITE_ENABLE_MOCKING=true
```

#### For CI/CD
Set environment variables in your CI/CD system matching the production configuration.

#### For Docker
Pass environment variables using Docker's `-e` flag or docker-compose environment files:
```bash
docker run -e VITE_APP_MODE=production -e VITE_API_URL=https://api.example.com ...
```

### Environment Parity

To maintain consistency across environments:
1. **Development**: Use `.env.local` for local overrides
2. **CI**: Set variables in CI configuration
3. **Docker**: Use environment variables or mounted env files
4. **Production**: Use secure environment variable management

**Important**: Never commit sensitive data like API keys or secrets to git. Use environment variables and ensure `.env.local` and `.env.test` are in `.gitignore`.
