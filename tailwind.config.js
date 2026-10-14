/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces / canvas — very light cool grey by default.
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--c-surface-2) / <alpha-value>)',
        hairline: 'rgb(var(--c-hairline) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        // Accents.
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        highlight: 'rgb(var(--c-highlight) / <alpha-value>)',
        link: 'rgb(var(--c-link) / <alpha-value>)',
        positive: 'rgb(var(--c-positive) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
      },
      borderRadius: {
        card: '24px',
        sheet: '28px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.12)',
        float: '0 8px 30px -8px rgba(16,24,40,0.22)',
        nav: '0 10px 40px -10px rgba(16,24,40,0.28)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Inter',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        display: ['44px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg': ['48px', { lineHeight: '1.02', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        // Route transition. No `both` fill: the element's resting state is
        // visible, so a screen can never be left faded-out or mid-transform
        // (which used to swallow touches after a fast tab switch).
        'screen-enter': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        'screen-enter': 'screen-enter 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
