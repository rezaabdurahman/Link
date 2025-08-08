/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aqua & White Design System
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1', 
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf', // Main aqua
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        aqua: {
          light: '#7dd3fc', // Light aqua
          DEFAULT: '#06b6d4', // Main aqua 
          dark: '#0891b2', // Dark aqua
          deeper: '#0e7490', // Deeper aqua
        },
        surface: {
          dark: '#0f172a', // Dark surface
          card: '#1e293b', // Card background
          hover: '#334155', // Hover state
        },
        text: {
          primary: '#ffffff',
          secondary: '#cbd5e1',
          muted: '#64748b',
        },
        accent: {
          pink: '#ec4899',
          purple: '#a855f7',
          orange: '#f97316',
          green: '#22c55e',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'San Francisco', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'sans-serif'],
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
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
