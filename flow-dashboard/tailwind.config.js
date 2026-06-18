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
        // 3 deliberate surface layers (Phase 7 overhaul).
        // Repurposed so existing bg-surface* usages map onto the new system:
        //   bg-surface         → zinc-950 (page / app background)
        //   bg-surface-raised  → zinc-900 (cards, panels)
        //   bg-surface-overlay → zinc-800 (modals, raised, hover)
        surface: {
          DEFAULT: '#09090B',
          raised: '#18181B',
          overlay: '#27272A',
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
        // rose is intentionally NOT overridden — it renders the real Tailwind
        // rose scale so destructive/error states are genuinely red.

        // ── Design-system aliases (Phase 7) ──────────────────────────────
        app: '#09090B',        // zinc-950 — page background
        raised: '#27272A',     // zinc-800 — modals / raised surfaces
        accent: {
          DEFAULT: '#6366F1',  // indigo-500 — primary buttons, active nav
          hover: '#818CF8',    // indigo-400
          muted: 'rgba(99, 102, 241, 0.10)', // subtle active backgrounds
          text: '#A5B4FC',     // indigo-300 — links / accent text on dark
        },
        success: '#10B981',    // emerald-500
        warning: '#F59E0B',    // amber-500
        error: '#F43F5E',      // rose-500
        info: '#6366F1',       // indigo-500 (same as accent)
      },
      // Flat design — all "glow" shadows neutralised to none app-wide.
      boxShadow: {
        glow: 'none',
        'glow-rose': 'none',
        'glow-amber': 'none',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'modal-in': 'modalIn 0.25s ease-out',
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
