# Onboarding Color Mapping - Blue/Indigo to Aqua Design System

This document maps all blue and indigo color tokens used in the onboarding flow to the new aqua-themed design system tokens as defined in `frontend/src/design-system.md`.

## Color Mapping Table

### Blue Token Mappings

| Old Token | New Token | Usage Context |
|-----------|-----------|---------------|
| `blue-50` | `primary-50` | Light backgrounds, subtle accents |
| `blue-100` | `primary-100` | Step badges, light backgrounds |
| `blue-500` | `primary-500` | Standard interactive elements |
| `blue-600` | `aqua` | Primary buttons, active states |
| `blue-700` | `aqua-dark` | Button hover states |
| `blue-800` | `primary-800` | Deep accent elements |

### Indigo Token Mappings

| Old Token | New Token | Usage Context |
|-----------|-----------|---------------|
| `indigo-50` | `primary-50` | Light gradient backgrounds |
| `indigo-600` | `primary-600` | Gradient components, logos |
| `indigo-700` | `primary-700` | Hover states for indigo elements |

### Gradient Mappings

| Old Gradient | New Gradient | Usage Context |
|--------------|-------------|---------------|
| `from-blue-50 to-indigo-50` | `from-primary-50 to-primary-100` | Background gradients |
| `from-blue-500 via-blue-600 to-indigo-600` | `from-primary-500 via-aqua to-primary-600` | Progress bars |
| `from-blue-600 to-indigo-600` | `from-aqua to-primary-600` | Primary buttons, logos |
| `from-blue-700 to-indigo-700` | `from-aqua-dark to-primary-700` | Button hover states |
| `from-green-500 to-blue-600` | `from-primary-500 to-aqua` | Success buttons |

### Specific Class Mappings

#### Background Classes
| Old Class | New Class |
|-----------|-----------|
| `bg-blue-50` | `bg-primary-50` |
| `bg-blue-100` | `bg-primary-100` |
| `bg-blue-500` | `bg-primary-500` |
| `bg-blue-600` | `bg-aqua` |
| `bg-blue-700` | `bg-aqua-dark` |
| `bg-indigo-600` | `bg-primary-600` |

#### Text Classes
| Old Class | New Class |
|-----------|-----------|
| `text-blue-500` | `text-primary-500` |
| `text-blue-600` | `text-aqua` |
| `text-blue-700` | `text-primary-700` |
| `text-blue-800` | `text-primary-800` |
| `text-indigo-600` | `text-primary-600` |

#### Border Classes
| Old Class | New Class |
|-----------|-----------|
| `border-blue-200` | `border-primary-200` |
| `border-blue-300` | `border-primary-300` |
| `border-blue-400` | `border-primary-400` |
| `border-blue-500` | `border-primary-500` |

#### Ring Classes (Focus States)
| Old Class | New Class |
|-----------|-----------|
| `ring-blue-500` | `ring-aqua/50` |
| `focus:ring-blue-500` | `focus:ring-aqua/50` |
| `focus:border-blue-500` | `focus:border-aqua` |

#### Hover State Classes
| Old Class | New Class |
|-----------|-----------|
| `hover:bg-blue-50` | `hover:bg-primary-50` |
| `hover:bg-blue-700` | `hover:bg-aqua-dark` |
| `hover:border-blue-300` | `hover:border-primary-300` |
| `hover:border-blue-400` | `hover:border-primary-400` |
| `hover:text-blue-700` | `hover:text-primary-700` |
| `hover:text-blue-800` | `hover:text-primary-800` |
| `hover:from-blue-700` | `hover:from-aqua-dark` |
| `hover:to-indigo-700` | `hover:to-primary-700` |

## Usage Priority

### Primary Usage (High Priority)
- **`aqua`** - Main brand color for primary buttons and key interactive elements
- **`aqua-dark`** - Hover states for primary actions
- **`primary-50`** - Light backgrounds and subtle accents
- **`primary-100`** - Step badges and secondary backgrounds

### Secondary Usage (Medium Priority)
- **`primary-500`** - Standard interactive elements and icons
- **`primary-600`** - Gradient endpoints and secondary buttons
- **`primary-700`** - Hover states for secondary elements

### Specialized Usage (Low Priority)
- **`primary-800`** - Deep accent elements (rare usage)
- **`aqua-light`** - Special highlight cases
- **`aqua-deeper`** - Extra emphasis (rare usage)

## Implementation Notes

1. **Brand Consistency**: All mappings align with the aqua-themed design system for consistent brand identity.

2. **Accessibility**: The aqua color palette maintains proper contrast ratios as defined in the design system.

3. **Hover Effects**: Use `.hover-glow` class for aqua shadow effects on interactive elements.

4. **Focus States**: Replace blue ring focus states with `ring-aqua/50` for consistency.

5. **Gradients**: Update all blue-indigo gradients to use primary/aqua tokens for cohesive branding.

## Component-Specific Applications

### OnboardingLayout.tsx
- Background: `bg-gradient-to-br from-blue-50 via-white to-indigo-50` → `bg-gradient-to-br from-primary-50 via-white to-primary-100`
- Logo: `from-blue-600 to-indigo-600` → `from-aqua to-primary-600`

### OnboardingProgressBar.tsx
- Progress fill: `from-blue-500 via-blue-600 to-indigo-600` → `from-primary-500 via-aqua to-primary-600`
- Current step dots: `bg-blue-100` → `bg-primary-100`
- Step labels: `text-blue-600` → `text-aqua`, `text-indigo-600` → `text-primary-600`

### Primary Buttons (All Components)
- Base: `bg-blue-600` → `bg-aqua`
- Hover: `hover:bg-blue-700` → `hover:bg-aqua-dark`
- Gradient: `from-blue-600 to-indigo-600` → `from-aqua to-primary-600`
- Gradient hover: `hover:from-blue-700 hover:to-indigo-700` → `hover:from-aqua-dark hover:to-primary-700`

---

**Note**: This mapping ensures visual consistency across the entire onboarding flow while maintaining the premium aqua-themed brand identity defined in the design system.
