/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        black: '#000000',
        white: '#FFFFFF',
        surface: {
          DEFAULT: '#000000',
          raised: '#09090B',
          overlay: '#121212',
        },
        slate: {
          50: '#F4F4F5',
          100: '#E4E4E7',
          200: '#D4D4D8',
          300: '#A1A1AA',
          400: '#71717A',
          500: '#52525B',
          600: '#3F3F46',
          700: '#27272A',
          750: '#27272A',
          800: '#27272A',
          900: '#18181B',
          950: '#09090B',
        },
        emerald: {
          500: '#FFFFFF',
          400: '#D4D4D8',
          100: '#18181B',
        },
        cyan: {
          500: '#FFFFFF',
          400: '#D4D4D8',
          100: '#18181B',
        },
        amber: {
          500: '#FFFFFF',
          400: '#D4D4D8',
          100: '#18181B',
        },
        violet: {
          500: '#FFFFFF',
          400: '#D4D4D8',
          100: '#18181B',
        },
        rose: {
          500: '#3F3F46',
          400: '#27272A',
          100: '#18181B',
        }
      },
      boxShadow: {
        glow: '0 0 10px rgba(255, 255, 255, 0.1)',
        'glow-rose': 'none',
        'glow-amber': 'none',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'modal-in': 'modalIn 0.25s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'toast-in': 'toastIn 0.3s ease-out forwards',
        'toast-out': 'toastOut 0.3s ease-in forwards',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(10px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgba(16, 185, 129, 0.3), 0 0 60px -15px rgba(16, 185, 129, 0.1)' },
          '50%': { boxShadow: '0 0 30px -5px rgba(16, 185, 129, 0.5), 0 0 80px -15px rgba(16, 185, 129, 0.2)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        toastOut: {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-8px) scale(0.95)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
