/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Unified Aqua & White Design System - Fixed Conflicts
        primary: {
          50: '#f0fdfa',   // Very light aqua tint
          100: '#ccfbf1',  // Light aqua tint
          200: '#99f6e4',  // Lighter aqua
          300: '#5eead4',  // Light aqua
          400: '#2dd4bf',  // Main aqua (primary)
          500: '#14b8a6',  // Standard aqua
          600: '#0d9488',  // Dark aqua
          700: '#0f766e',  // Darker aqua
          800: '#115e59',  // Very dark aqua
          900: '#134e4a',  // Deepest aqua
        },
        // Simplified aqua system - remove duplicates
        aqua: {
          light: '#2dd4bf',  // Maps to primary-400 for consistency
          DEFAULT: '#14b8a6', // Maps to primary-500 - main brand color
          dark: '#0d9488',   // Maps to primary-600
          deeper: '#0f766e', // Maps to primary-700
        },
        // Semantic color system
        semantic: {
          success: '#22c55e',    // Green for success states
          warning: '#f59e0b',    // Amber for warnings  
          danger: '#ef4444',     // Red for errors/danger
          info: '#3b82f6',       // Blue for info states
        },
        // Fixed surface colors for light theme consistency
        surface: {
          primary: '#ffffff',    // Main background
          secondary: '#f8fafc',  // Secondary background  
          card: '#ffffff',       // Card backgrounds
          hover: '#f1f5f9',      // Hover states
          border: '#e2e8f0',     // Border color
        },
        // Fixed text colors for light theme
        text: {
          primary: '#1f2937',    // Primary text (dark)
          secondary: '#4b5563',  // Secondary text
          muted: '#6b7280',      // Muted text
          inverse: '#ffffff',    // Inverse text (on dark backgrounds)
        },
        // Enhanced accent system
        accent: {
          copper: '#b45309',         // Main copper brown
          'copper-light': '#d97706', // Light copper
          'copper-dark': '#92400e',  // Dark copper
          charcoal: '#374151',       // Charcoal gray
          pink: '#ec4899',           // Pink accent
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'San Francisco', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
      },
      // Standardized size system for consistent component sizing
      size: {
        xs: '2rem',    // 32px - Extra small
        sm: '2.5rem',  // 40px - Small  
        md: '3rem',    // 48px - Medium (default)
        lg: '3.5rem',  // 56px - Large
        xl: '4rem',    // 64px - Extra large
        '2xl': '5rem', // 80px - 2X Large
      },
      spacing: {
        '18': '4.5rem',  // 72px
        '22': '5.5rem',  // 88px
      },
      borderRadius: {
        'ios': '10px',
        'card': '16px',
        'modal': '20px',
      },
      backdropBlur: {
        'ios': '20px',
      },
      boxShadow: {
        'ios': '0 4px 16px rgba(0, 0, 0, 0.1)',
        'modal': '0 20px 40px rgba(0, 0, 0, 0.3)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 2s infinite',
        'cursor-blink': 'blink 1s infinite',
        'scroll-text': 'scrollText 12s linear infinite',
        'grid-slide-up': 'gridSlideUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'card-entrance': 'cardEntrance 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'search-slide-down': 'searchSlideDown 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'word-cycle': 'wordCycle 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        'word-glow': 'wordGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'view-toggle-fade': 'viewToggleFade 0.25s ease-in-out',
        'fade-out': 'fadeOut 0.2s ease-in',
        'scale-fade-in': 'scaleFadeIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'slide-fade-up': 'slideFadeUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        scrollText: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        gridSlideUp: {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(40px) scale(0.94)',
            filter: 'blur(6px)'
          },
          '40%': {
            opacity: '0.4',
            transform: 'translateY(15px) scale(0.97)',
            filter: 'blur(3px)'
          },
          '70%': {
            opacity: '0.8',
            transform: 'translateY(2px) scale(0.99)',
            filter: 'blur(1px)'
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0px)'
          },
        },
        cardEntrance: {
          '0%': { 
            opacity: '0',
          },
          '100%': { 
            opacity: '1',
          },
        },
        searchSlideDown: {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(-30px) scale(0.95)',
            filter: 'blur(4px)'
          },
          '40%': {
            opacity: '0.6',
            transform: 'translateY(-5px) scale(0.98)',
            filter: 'blur(2px)'
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0) scale(1)',
            filter: 'blur(0px)'
          },
        },
        wordCycle: {
          '0%': { 
            transform: 'translateY(0) scale(1)',
            opacity: '1'
          },
          '50%': { 
            transform: 'translateY(-8px) scale(0.98)',
            opacity: '0.3'
          },
          '100%': { 
            transform: 'translateY(0) scale(1)',
            opacity: '1'
          },
        },
        wordGlow: {
          '0%, 100%': { 
            textShadow: '0 0 5px rgba(6, 182, 212, 0.3)'
          },
          '50%': { 
            textShadow: '0 0 20px rgba(6, 182, 212, 0.6), 0 0 30px rgba(6, 182, 212, 0.4)'
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        viewToggleFade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        scaleFadeIn: {
          '0%': { 
            opacity: '0', 
            transform: 'scale(0.9)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        },
        slideFadeUp: {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(24px)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0)' 
          },
        },
        bounceIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.3)',
          },
          '50%': {
            opacity: '0.9',
            transform: 'scale(1.05)',
          },
          '80%': {
            opacity: '1',
            transform: 'scale(0.97)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
