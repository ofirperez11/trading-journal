/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Amber-terminal palette — deep cool graphite, warm phosphor ink.
        bg: '#0A0C10',
        surface: '#12151B',
        'surface-2': '#181C24',
        border: '#222732',
        ink: '#ECEAE3',
        muted: '#8B8A82',
        // Brand = the terminal's amber phosphor. (accent/accent-2 kept as names.)
        accent: '#F4A93C',
        'accent-2': '#FFC661',
        // Trading semantics — the real protagonists.
        win: '#3FCF8E',
        loss: '#F26D6D',
      },
      fontFamily: {
        display: ['"Frank Ruhl Libre"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans Hebrew"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bob-up': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        'bob-down': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(3px)' },
        },
        'zoom-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.82' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'bob-up': 'bob-up 1.6s ease-in-out infinite',
        'bob-down': 'bob-down 1.6s ease-in-out infinite',
        'zoom-in': 'zoom-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
}
