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

## Screenshots

### Onboarding Flow
![Onboarding Welcome](docs/screenshots/onboarding-welcome.png)
*Welcome screen with step-by-step progress indicator*

![Profile Setup](docs/screenshots/onboarding-profile.png)
*Interactive profile picture and bio setup*

![Interest Selection](docs/screenshots/onboarding-interests.png)
*Tag-based interest selection with aqua theme*

### Core App Experience
![Discovery Page](docs/screenshots/discovery-page.png)
*Clean discovery interface with user cards and filters*

![Chat Interface](docs/screenshots/chat-interface.png)
*iOS-style chat with search and conversation management*

![User Profile](docs/screenshots/user-profile.png)
*Detailed user profile with glass morphism design*

*Note: Screenshots will be added as the UI is finalized. The current implementation focuses on functionality and responsive design.*

## Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

### Testing
- `npm run test` - Run unit tests
- `npm run test:watch` - Run unit tests in watch mode
- `npm run test:coverage` - Run unit tests with coverage
- `npm run test:e2e` - Run E2E tests headlessly
- `npm run test:e2e:dev` - Open Cypress test runner
- `npm run cypress:open` - Open Cypress test runner
- `npm run cypress:run` - Run Cypress tests headlessly

### Accessibility
- `npm run audit:contrast` - Run color contrast analysis for WCAG compliance
- `npm run audit:a11y` - Run accessibility linting (ESLint JSX a11y)
- `npm run audit:full` - Run complete accessibility audit

## Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Page-level components
├── hooks/         # Custom React hooks
├── services/      # API service layer and data fetching
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
- **Service Layer Architecture** for API communication

## Design System

The application uses a comprehensive design system built with Tailwind CSS, featuring:

### 🎨 Aqua & White Theme
- Modern color palette with aqua (#06b6d4) as the primary brand color
- Clean white backgrounds with subtle transparency effects
- Removed green accents for better brand coherence

### 🌟 Key Features
- **Glass Morphism**: Backdrop blur effects and semi-transparent cards
- **iOS-Style Interactions**: Haptic feedback simulation and smooth animations
- **Responsive Design**: Mobile-first approach optimized for all devices
- **Dark Mode Native**: Designed specifically for dark themes
- **Accessibility First**: WCAG AA compliance with proper contrast ratios

### 📖 Documentation
Detailed design system documentation is available in:
- `src/design-system.md` - Complete color palette, components, and usage examples
- Includes onboarding flow examples and component patterns
- Typography, spacing, and layout guidelines
- Animation and interaction specifications

### 🧩 Component Examples
The design system includes examples for:
- Onboarding step containers and progress indicators
- User cards with hover effects and transitions
- Button variants (primary, secondary, loading states)
- Form inputs with focus states
- Status indicators and badges
- Navigation patterns

## Development Guidelines

- Use TypeScript strict mode
- Follow ESLint rules
- Write tests for new features
- Use semantic commit messages
- Maintain 80%+ code coverage
- Ensure WCAG AA accessibility compliance
- Test keyboard navigation and screen reader compatibility

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

## Features

### Friend Search in Chat

The chat interface includes intelligent friend search functionality that provides mixed search results combining existing conversations and discoverable friends.

**Key Features:**
- **Real-time Search**: Debounced search with 300ms delay for optimal performance
- **Mixed Results**: Combines existing chat conversations with friend search results
- **Smart Prioritization**: Existing conversations appear first, followed by new friends
- **Loading States**: Skeleton shimmer animations during search
- **Error Handling**: Graceful fallback when friend search API fails
- **Empty States**: Clear messaging when no results are found
- **One-tap Chat**: Click any friend result to start a new conversation

**Technical Implementation:**
- Uses `searchFriends` API from `userClient` service
- Creates pseudo-chat objects for friends without existing conversations
- Integrates with existing conversation management system
- Supports conversation creation via `createConversation` API
- Real-time UI updates with optimistic rendering

**User Experience:**
1. User types in the search input
2. System shows loading skeleton after 300ms debounce
3. Existing conversations are filtered by participant name/summary
4. Friend search API is called for additional results
5. Mixed results are displayed with clear visual distinction
6. Clicking any result opens conversation (creates new one if needed)

### E2E Testing

Comprehensive end-to-end testing with Cypress covers the friend search functionality:

**Test Coverage:**
- Mixed search results display
- Loading states and debouncing
- Empty states and error handling
- Friend result click-to-chat functionality
- Mobile responsiveness
- API error graceful degradation

**Running E2E Tests:**
```bash
# Interactive test runner (recommended for development)
npm run test:e2e:dev

# Headless test execution (for CI/CD)
npm run test:e2e

# Open Cypress test runner
npm run cypress:open
```

**Test Files:**
- `cypress/e2e/friend-search-in-chat.cy.ts` - Main friend search test suite
- `cypress/support/commands.ts` - Custom Cypress commands
- `cypress/support/e2e.ts` - Global test configuration

## Services

The application uses a service layer architecture for API communication, providing separation of concerns and consistent error handling.

### User Client

The `userClient` provides functions for user profile operations:

#### `getUserProfile(userId: string): Promise<UserProfileResponse>`

Fetches a user profile by user ID with comprehensive error handling.

**Features:**
- Parameter validation
- Consistent error handling with `AuthServiceError`
- Support for extended profile data (friend status, privacy settings, etc.)
- Integration with existing auth client patterns

**Usage:**
```typescript
import { getUserProfile, getProfileErrorMessage } from '../services/userClient';

try {
  const profile = await getUserProfile('user-123');
  // Handle successful profile data
} catch (error) {
  const errorMessage = getProfileErrorMessage(error.error, userId);
  // Handle error with user-friendly message
}
```

**Error Handling:**
- `VALIDATION_ERROR` - Invalid or missing user ID
- `AUTHORIZATION_ERROR` - Access denied to private profiles
- `AUTHENTICATION_ERROR` - User not logged in
- `SERVER_ERROR` - Network or server issues

**Helper Functions:**
- `getProfileErrorMessage(error, userId?)` - Get user-friendly error messages
- `isProfileAccessible(error)` - Check if profile access error is recoverable

### Service Integration

Services are integrated with React components using standard patterns:

1. **Loading States** - Components show skeleton loaders during API calls
2. **Error Handling** - User-friendly error messages with retry options
3. **Type Safety** - Full TypeScript support with proper interfaces
4. **Consistent Patterns** - All services follow the same error handling approach

**Example Integration:**
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string>();

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getUserProfile(userId);
      // Handle success
    } catch (err) {
      setError(getProfileErrorMessage(err.error, userId));
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [userId]);
```

## Accessibility

This application follows WCAG 2.1 AA standards to ensure accessibility for all users.

### Compliance Status

- **Color Contrast**: 57.6% WCAG AA compliant (38/66 combinations)
- **Interactive Elements**: Full keyboard navigation support
- **Screen Reader**: ARIA labels and semantic HTML
- **Focus Management**: Visible focus indicators

### Automated Testing

Run accessibility audits regularly during development:

```bash
# Complete accessibility audit
npm run audit:full

# Color contrast analysis only
npm run audit:contrast

# ESLint accessibility rules only  
npm run audit:a11y
```

### Color Usage Guidelines

#### Safe Colors (WCAG AA Compliant)
- **Text**: `text-primary`, `text-secondary`
- **Interactive**: `primary-700+`, `aqua-accessible`
- **Accents**: All copper variants, `accent-charcoal`

#### Restricted Colors (Use Carefully)
- `primary-400` to `primary-600`: Decorative use only
- `aqua-light`, `aqua-dark`: Avoid for text or critical UI
- `text-muted`: Ensure sufficient background contrast

### Keyboard Navigation

All interactive elements support keyboard navigation:
- **Tab**: Move between focusable elements
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and dropdowns
- **Arrow Keys**: Navigate within components (when applicable)

### Screen Reader Support

- Semantic HTML structure
- ARIA labels for complex interactions
- Live regions for dynamic content
- Descriptive alt text for images
- Form labels properly associated

### Development Checklist

For each new component:

- [ ] Color contrast meets 4.5:1 ratio
- [ ] Keyboard navigation works
- [ ] Screen reader announces content correctly
- [ ] Focus indicators are visible
- [ ] ARIA roles and labels are appropriate
- [ ] Images have descriptive alt text
- [ ] Forms have proper labels

### Testing Tools

- **Automated**: ESLint JSX a11y, custom contrast analyzer
- **Manual**: Keyboard navigation, screen reader testing
- **Browser**: Chrome DevTools Lighthouse accessibility audit

### Resources

- Full audit report: `ACCESSIBILITY_AUDIT_REPORT.md`
- Color combinations: `contrast-audit-results.json`
- Guidelines: [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/AA/)
