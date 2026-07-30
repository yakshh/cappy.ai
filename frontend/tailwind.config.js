/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand palette
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',  // Primary
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Dark theme surfaces
        dark: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          800: '#1e293b',
          850: '#172033',
          900: '#0f172a',
          950: '#090e1a',
        },
        // Accent
        accent: {
          cyan:   '#22d3ee',
          purple: '#a855f7',
          rose:   '#f43f5e',
          amber:  '#f59e0b',
          emerald:'#10b981',
        },
      },
      backgroundImage: {
        'gradient-brand':  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        'gradient-dark':   'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        'gradient-card':   'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(168,85,247,0.1) 100%)',
        'gradient-glow':   'radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'brand':    '0 0 20px rgba(99,102,241,0.35)',
        'brand-lg': '0 0 40px rgba(99,102,241,0.25)',
        'glass':    '0 8px 32px rgba(0,0,0,0.3)',
        'card':     '0 4px 24px rgba(0,0,0,0.2)',
      },
      animation: {
        'fade-in':      'fadeIn 0.4s ease-out',
        'slide-up':     'slideUp 0.4s ease-out',
        'slide-in-left':'slideInLeft 0.3s ease-out',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'bounce-slow':  'bounce 2s infinite',
        'typing':       'typing 1.2s steps(3, end) infinite',
        'shimmer':      'shimmer 1.5s infinite',
        'float':        'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        typing: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
