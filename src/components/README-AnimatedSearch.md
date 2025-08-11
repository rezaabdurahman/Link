---
redirect_to: /frontend/src/components/README-AnimatedSearch.md
status: "moved"
reason: "Consolidated duplicate files - moved to frontend structure"
---

# Animated Search Input Feature

## Overview
The **AnimatedSearchInput** component provides a realistic typing animation for search placeholders, cycling through different search suggestions to inspire users and showcase the app's capabilities.

## 🎭 Animation Details

### Typing Effect
- **Typing Speed**: 80ms per character (feels natural and readable)
- **Deleting Speed**: 40ms per character (faster deletion, mimics real typing)
- **Pause Duration**: 2.5 seconds (gives users time to read the full suggestion)
- **Infinite Loop**: Continuously cycles through all suggestions

### Cursor Animation
- **Blinking Cursor**: Aqua-colored cursor (`bg-aqua/70`) with 1-second blink cycle
- **Always Visible**: Cursor continues blinking throughout typing and pausing
- **Tailwind Animation**: Uses custom `animate-cursor-blink` class

## 🎯 Search Suggestions

The component cycles through these engaging suggestions:

1. **"find me a tall guy with blue eyes"** - Physical preferences
2. **"find me a venture capitalist"** - Professional/career focus  
3. **"find me someone who loves art"** - Cultural interests
4. **"find me a fitness enthusiast"** - Lifestyle preferences
5. **"find me a foodie"** - Hobby-based connections
6. **"find me a book lover"** - Intellectual interests

## 🔧 Technical Implementation

### Components
- **`useTypingAnimation`** - Custom React hook managing the typing state machine
- **`AnimatedSearchInput`** - Main component with overlay placeholder technique
- **Cursor Blink** - Pure CSS animation using Tailwind keyframes

### State Management
```typescript
interface UseTypingAnimationReturn {
  displayText: string;     // Current visible text
  isTyping: boolean;       // Whether currently typing
  isDeleting: boolean;     // Whether currently deleting  
  currentIndex: number;    // Index of current suggestion
}
```

### Animation States
1. **Typing**: Characters appear one by one
2. **Pause**: Full text displayed with blinking cursor
3. **Deleting**: Characters disappear from right to left
4. **Transition**: Brief pause before next suggestion starts

## 🎨 Visual Design

### Layout Technique
- **Input Field**: Real input for user interaction (transparent placeholder)
- **Overlay Text**: Positioned absolutely over the input for animation
- **Z-Index Layering**: Search icon (z-10) → Overlay text (z-5) → Input (z-0)
- **Pointer Events**: Overlay text ignores clicks, input receives focus

### Styling
- **Font**: Matches input field styling (`text-base`)
- **Color**: Muted text color (`text-text-muted`) for subtle appearance
- **Cursor**: Aqua accent color for brand consistency
- **Positioning**: Precisely aligned with input text position

## ⚡ Performance Considerations

### Optimizations
- **Cleanup**: Automatically clears timeouts to prevent memory leaks
- **Efficient Updates**: Only re-renders when animation state changes
- **Minimal DOM**: Single overlay element with CSS animations
- **React Hooks**: Follows React best practices for state management

### Resource Usage
- **Memory**: Very low - only stores current text state
- **CPU**: Minimal - simple timeout-based state machine
- **Rendering**: Efficient - uses CSS animations for cursor blink

## 🚀 Usage Example

```tsx
<AnimatedSearchInput
  value={searchQuery}
  onChange={setSearchQuery}
  suggestions={[
    'find me a tall guy with blue eyes',
    'find me a venture capitalist',
    // ... more suggestions
  ]}
  className="mb-6"
/>
```

## 🌟 User Experience Benefits

1. **Engagement**: Catches user attention with motion
2. **Discovery**: Shows various search possibilities
3. **Inspiration**: Suggests different ways to find connections
4. **Brand Personality**: Adds playful, modern feel to the app
5. **Functionality Preview**: Demonstrates search capabilities

## 🔮 Future Enhancements

Potential improvements could include:
- **Personalized Suggestions**: Based on user's interests or past searches
- **Seasonal Suggestions**: Holiday or event-themed search ideas
- **Location-Aware**: Suggestions based on user's location
- **AI-Generated**: Dynamic suggestions from user behavior patterns
- **Sound Effects**: Subtle typing sounds (with user preference toggle)

This feature transforms a static search bar into an engaging, dynamic element that both educates users about search possibilities and adds personality to the app experience.
