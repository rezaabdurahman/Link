# Link - iOS Frontend Mockup

**Tagline:** *"Turn proximity into possibility. AI-powered connections, in real life."*

Link is an AI-powered social app that facilitates real-life connections and helps maintain friendships through intelligent suggestions, proximity-based discovery, and proactive relationship building.

## 🎯 Project Vision

Link bridges the real-life social gap by providing:
- **Context-driven connections** - Discover nearby people with AI-suggested conversation starters
- **Living friendship maintenance** - Replace small talk with AI-curated life updates
- **Memory enhancement** - Never lose touch with important details that matter
- **Proactive relationship building** - Get nudges to connect before relationships fade

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd /Users/RezaAbdurahman/Desktop/Projects/Link
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## 📱 Features Implemented

### Discovery Page
- **Grid-based user discovery** (inspired by Grindr's layout)
- **Proximity-based ranking** with mutual friends and interests
- **Availability toggle** - Show when you're open for connections
- **Smart search** by name and interests
- **Real-time status indicators**

### Chat Page
- **WhatsApp-like chat interface** with multiple sorting options
- **AI-powered search suggestions** ("Who plays volleyball?")
- **Stories integration** at the top of chats
- **Conversation summaries** for quick context
- **Priority-based chat ordering**

### Opportunities Page
- **AI-suggested connection activities**
- **Friendship reminders** based on interaction patterns
- **Seasonal and contextual suggestions**
- **Smart filtering** by opportunity type

### Profile Page
- **Editable bio and interests**
- **Connection statistics dashboard**
- **Comprehensive settings** for privacy and preferences
- **iOS-style interface elements**

## 🛠 Tech Stack

- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router DOM
- **Icons:** Lucide React
- **Styling:** CSS-in-JS with iOS Design System
- **Testing:** Jest + React Testing Library
- **Linting:** ESLint with TypeScript rules
- **Type Safety:** TypeScript in strict mode

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── TabBar.tsx      # Bottom navigation
│   ├── UserCard.tsx    # Discovery user cards
│   ├── ChatListItem.tsx # Chat list items
│   ├── StoriesBar.tsx  # Stories component
│   └── OpportunityCard.tsx # Opportunity suggestions
├── pages/              # Main page components
│   ├── DiscoveryPage.tsx
│   ├── ChatPage.tsx
│   ├── OpportunitiesPage.tsx
│   └── ProfilePage.tsx
├── types/              # TypeScript type definitions
├── data/               # Mock data and API functions
├── hooks/              # Custom React hooks
└── utils/              # Utility functions
```

## 🎨 Design System

The app follows iOS Human Interface Guidelines with:
- **Dark theme** with proper contrast ratios
- **iOS-style cards** with backdrop blur effects
- **Haptic feedback** simulation with scale transforms
- **Safe area** handling for iOS devices
- **Smooth animations** with CSS transitions

## 📱 iOS-Specific Features

- **375px container width** for iPhone viewport
- **Safe area insets** for status bar and home indicator
- **iOS color palette** (System Blue, Green, Orange, etc.)
- **Native-like interactions** with proper touch targets
- **Blur effects** and translucent backgrounds

## 🧪 Testing

The project includes:
- **Component testing** with React Testing Library
- **Type safety** with TypeScript strict mode
- **Linting** with comprehensive ESLint rules
- **Coverage reporting** for quality assurance

Run tests with:
```bash
npm run test
npm run test:coverage
```

## 🔒 Privacy & Security

Following the established rules:
- **No secrets in code** - Environment variables for sensitive data
- **Privacy-first approach** - Location sharing is opt-in with proximity controls
- **Secure data handling** - All user data properly typed and validated

## 🚀 Deployment

The app is configured for local development but can be deployed to:
- **Docker containers** for consistent environments
- **Static hosting** services (Vercel, Netlify)
- **CDN deployment** for global distribution

## 🤝 Contributing

This is a mockup project demonstrating the Link concept. The codebase follows:
- **Conventional commits** (feat:, fix:, docs:, etc.)
- **TypeScript strict mode** with proper type annotations
- **ESLint rules** for consistent code quality
- **Component-based architecture** for maintainability

## 📄 License

This project is a demonstration mockup for the Link social app concept.

---

**Built with ❤️ using TypeScript, React, and modern web technologies.**
