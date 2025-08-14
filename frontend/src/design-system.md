# Link App - Design System Documentation

## Overview
We've implemented a modern, cohesive design system using **Tailwind CSS** with a beautiful **aqua & white** color palette that creates a fresh, welcoming, and premium feel.

## 🎨 Color Palette

### Primary Colors (Aqua Themed)
```css
primary-50:  #f0fdfa   /* Very light aqua tint */
primary-100: #ccfbf1   /* Light aqua tint */
primary-200: #99f6e4   /* Lighter aqua */
primary-300: #5eead4   /* Light aqua */
primary-400: #2dd4bf   /* Main aqua (primary) */
primary-500: #14b8a6   /* Standard aqua */
primary-600: #0d9488   /* Dark aqua */
primary-700: #0f766e   /* Darker aqua */
primary-800: #115e59   /* Very dark aqua */
primary-900: #134e4a   /* Deepest aqua */
```

### Aqua Variants
```css
aqua-light:  #7dd3fc   /* Light aqua for highlights */
aqua:        #06b6d4   /* Main brand aqua */
aqua-dark:   #0891b2   /* Dark aqua for hover states */
aqua-deeper: #0e7490   /* Deeper aqua for emphasis */
```

### Surface Colors
```css
surface-dark: #0f172a  /* Main dark background */
surface-card: #1e293b  /* Card backgrounds */
surface-hover: #334155 /* Hover states */
```

### Text Colors
```css
text-primary:   #ffffff    /* Main text (white) */
text-secondary: #cbd5e1    /* Secondary text (light gray) */
text-muted:     #64748b    /* Muted text (gray) */
```

### Accent Colors
```css
accent-pink:   #ec4899    /* Pink accents */
accent-copper: #b45309    /* Copper accents (main) */
accent-copper-light: #d97706  /* Light copper for highlights */
accent-copper-dark: #92400e   /* Dark copper for emphasis */
```

**Note:** We removed the green accent color to streamline the palette - all success states and positive indicators now use aqua for better brand coherence.

## 🧩 Component System

### Cards
- **`.ios-card`** - Standard card with glass morphism effect
- Uses `bg-surface-card`, `backdrop-blur-ios`, `rounded-card`
- Subtle borders with `border-white/10`

### Buttons
- **`.ios-button`** - Primary aqua buttons
- **`.ios-button-secondary`** - Secondary transparent buttons
- Hover effects with scaling and color transitions
- **`.hover-glow`** - Adds aqua glow effect on hover

### Text Fields
- **`.ios-text-field`** - Input fields with iOS-style appearance
- Focus states with aqua ring: `ring-aqua/50`
- Consistent padding and border radius

### Status Indicators
- **`.online-indicator`** - Aqua availability indicator (was green, changed for palette consistency)
- **`.offline-indicator`** - Copper busy/offline indicator

## 🎭 Animations & Effects

### Custom Animations
```css
fade-in:    /* Smooth fade in from bottom */
slide-up:   /* Slide up entrance animation */
pulse-slow: /* Slow pulse for emphasis */
```

### Hover Effects
- **`.hover-scale`** - Subtle scale on hover
- **`.hover-glow`** - Aqua shadow glow effect
- **`.haptic-light`** - Press-down effect on tap

### Gradients
- **`.text-gradient-aqua`** - Aqua to light aqua text gradient
- **`.text-gradient-primary`** - White to gray text gradient

## 📱 Layout System

### Spacing
- Consistent padding and margins using Tailwind's spacing scale
- `px-5` (20px) for page padding
- `mb-6` (24px) for section spacing
- `gap-4` (16px) for grid layouts

### Typography
- System font stack: `-apple-system, BlinkMacSystemFont, San Francisco`
- Responsive text sizes: `text-xs` to `text-3xl`
- Font weights: `font-medium`, `font-semibold`, `font-bold`

### Border Radius
- **`rounded-ios`** (10px) - Standard iOS-style corners
- **`rounded-card`** (16px) - Card corners
- **`rounded-modal`** (20px) - Modal corners

## 🌟 Key Features

### Glass Morphism
- Backdrop blur effects with `backdrop-blur-ios`
- Semi-transparent backgrounds
- Subtle borders and shadows

### Responsive Design
- Mobile-first approach with `max-w-sm` container
- Grid layouts: `grid-cols-2` for user cards
- Flexible layouts with Flexbox utilities

### Dark Mode Native
- Designed specifically for dark themes
- High contrast with white text on dark surfaces
- Aqua accents provide vibrant highlights

### iOS-Style Interactions
- Haptic feedback simulation
- Scale animations on press
- Smooth transitions throughout

## 🔧 Usage Examples

### User Cards
```tsx
<div className="ios-card haptic-light fade-in hover-glow group cursor-pointer p-4">
  <img className="w-full aspect-square rounded-ios object-cover transition-transform duration-300 group-hover:scale-105" />
  <h3 className="text-base font-semibold mb-1 leading-tight text-gradient-primary">Name</h3>
  <span className="bg-aqua/20 text-aqua px-2 py-0.5 rounded-full text-xs font-medium">Interest</span>
</div>
```

### Primary Button
```tsx
<button className="bg-aqua hover:bg-aqua-dark text-white font-semibold py-3 px-6 rounded-ios transition-all duration-200 hover-glow">
  Action Button
</button>
```

### Status Indicator
```tsx
<div className="flex items-center gap-2">
  <div className="w-3 h-3 bg-aqua rounded-full" />
  <span className="text-aqua text-sm font-medium">Available</span>
</div>
```

## 🎓 Onboarding Examples

### Onboarding Step Container
```tsx
<div className="w-full space-y-10">
  {/* Step Header */}
  <div className="text-center mb-8">
    <div className="inline-flex items-center space-x-2 bg-aqua/10 text-aqua px-3 py-2 rounded-full text-sm font-medium mb-4">
      <span className="w-5 h-5 bg-aqua/20 rounded-full flex items-center justify-center text-xs font-bold">1</span>
      <span>Step 1 of 7</span>
    </div>
    <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-4">Step Title</h1>
    <p className="text-lg text-secondary max-w-2xl mx-auto">Step description text</p>
  </div>
</div>
```

### Progress Bar
```tsx
<div className="w-full bg-surface-card rounded-full h-3 overflow-hidden">
  <div 
    className="h-full bg-gradient-to-r from-aqua-light to-aqua transition-all duration-500 ease-out rounded-full"
    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
  />
  <div className="absolute inset-0 rounded-full bg-aqua/20 animate-pulse-slow opacity-50" />
</div>
```

### Onboarding Card Layout
```tsx
<div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 sm:p-10 lg:p-12 min-h-[600px] backdrop-blur-sm">
  {/* Content goes here */}
</div>
```

### Interest Tag Selection
```tsx
<div className="flex flex-wrap gap-3">
  {interests.map(interest => (
    <button
      key={interest.id}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
        selectedInterests.includes(interest.id)
          ? 'bg-aqua text-white shadow-md hover-scale'
          : 'bg-surface-card text-secondary border border-white/20 hover:border-aqua/30 hover-scale'
      }`}
    >
      {interest.name}
    </button>
  ))}
</div>
```

### Step Navigation Buttons
```tsx
<div className="flex justify-between items-center pt-8">
  <button 
    className="text-muted hover:text-secondary transition-colors disabled:opacity-50"
    disabled={isFirstStep}
  >
    ← Previous
  </button>
  
  <button className="bg-aqua hover:bg-aqua-dark text-white font-semibold py-3 px-8 rounded-ios transition-all duration-200 hover-glow disabled:opacity-50">
    {isLastStep ? 'Complete Setup' : 'Continue →'}
  </button>
</div>
```

### Welcome Tutorial Features List
```tsx
<div className="bg-gradient-to-r from-primary-50 to-aqua/5 rounded-2xl p-8 space-y-6">
  <h3 className="text-2xl font-bold text-primary mb-6">Here's what you can do now:</h3>
  <div className="space-y-4">
    {features.map((feature, index) => (
      <div key={index} className="flex items-center space-x-4">
        <div className="w-8 h-8 bg-aqua rounded-full flex items-center justify-center flex-shrink-0">
          <Check className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg text-secondary">{feature}</span>
      </div>
    ))}
  </div>
</div>
```

### Loading States in Onboarding
```tsx
{/* Loading Spinner */}
<div className="flex items-center justify-center min-h-[400px]">
  <LoadingSpinner size="lg" />
</div>

{/* Button Loading State */}
<button 
  disabled={isLoading}
  className="bg-aqua hover:bg-aqua-dark text-white font-semibold py-3 px-8 rounded-ios transition-all duration-200 hover-glow disabled:opacity-50 flex items-center space-x-2"
>
  {isLoading && <LoadingSpinner size="sm" color="white" />}
  <span>{isLoading ? 'Saving...' : 'Continue'}</span>
</button>
```

## 🎯 Design Principles

1. **Consistency** - All components follow the same visual patterns
2. **Accessibility** - High contrast ratios and clear visual hierarchy  
3. **Performance** - Minimal CSS with utility-first approach
4. **Scalability** - Easy to extend and maintain
5. **Brand Coherence** - Aqua theme throughout creates strong identity

This design system provides a solid foundation for a premium, modern mobile app experience while maintaining the familiar iOS aesthetics users expect.
