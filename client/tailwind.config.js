/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        hair: 'rgb(var(--color-hair) / <alpha-value>)',
        azure: {
          DEFAULT: 'rgb(var(--color-azure) / <alpha-value>)',
          soft: 'rgb(var(--color-azure-soft) / <alpha-value>)',
          deep: 'rgb(var(--color-azure-deep) / <alpha-value>)',
        },
        aqua: {
          DEFAULT: 'rgb(var(--color-aqua) / <alpha-value>)',
          soft: 'rgb(var(--color-aqua-soft) / <alpha-value>)',
        },
        iris: {
          DEFAULT: 'rgb(var(--color-iris) / <alpha-value>)',
          soft: 'rgb(var(--color-iris-soft) / <alpha-value>)',
        },
        signal: 'rgb(var(--color-signal) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,27,54,.04), 0 12px 28px -18px rgba(10,27,54,.28)',
        lift: '0 2px 6px rgba(10,27,54,.06), 0 26px 44px -22px rgba(27,92,229,.42)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.7)',
      },
      keyframes: {
        sweep: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(220%)' } },
        rise: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'none' } },
        pulseRing: { '0%,100%': { opacity: 0.55 }, '50%': { opacity: 1 } },
      },
      animation: {
        sweep: 'sweep 2.4s ease-in-out infinite',
        rise: 'rise .5s cubic-bezier(.22,1,.36,1) both',
        pulseRing: 'pulseRing 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
