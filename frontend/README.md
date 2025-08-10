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

Copy `.env.example` from the project root and configure as needed.
