/** @type {import('tailwindcss').Config} */
// Los colores se exponen como tokens semánticos que apuntan a CSS variables
// definidas en src/styles/tokens.css. Así el modo claro/oscuro y los 6 acentos
// sepia se conmutan sin recompilar: solo cambian las variables en :root.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--surface)',
        'surface-alt': 'var(--surface-alt)',
        'segment-track': 'var(--segment-track)',
        'segment-active': 'var(--segment-active)',
        ink: 'var(--text-primary)',
        'ink-soft': 'var(--text-soft)',
        hairline: 'var(--hairline)',
        'control-border': 'var(--control-border)',
        placeholder: 'var(--placeholder)',
        accent: 'var(--accent)',
        'accent-action': 'var(--accent-action)',
        'accent-ink': 'var(--accent-ink)',
        'accent-tint': 'var(--accent-tint)',
        'accent-tint-nav': 'var(--accent-tint-nav)',
        'on-accent': 'var(--on-accent)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Inter"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        pill: '8px',
        input: '14px',
        card: '16px',
        container: '24px',
      },
      maxWidth: {
        content: '600px',
        'content-wide': '620px',
      },
      transitionTimingFunction: {
        soft: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
