/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Apple-inspired light palette — white/parchment canvas, near-black ink,
        // a single Action Blue accent. (Win/loss kept for trading semantics.)
        bg: '#ffffff', // canvas
        surface: '#f5f5f7', // parchment
        'surface-2': '#fafafc', // pearl
        border: '#d2d2d7', // hairline
        ink: '#1d1d1f',
        muted: '#6e6e73',
        // The single interactive color.
        accent: '#0066cc',
        'accent-2': '#0071e3',
        // Trading semantics (Apple system green / red).
        win: '#34c759',
        loss: '#ff3b30',
        // Near-black tile surface for the rare dark section.
        tile: '#1d1d1f',
      },
      fontFamily: {
        // SF Pro on Apple devices (incl. Hebrew) via system-ui; Heebo as the
        // open fallback elsewhere.
        display: ['system-ui', '-apple-system', '"Heebo"', '"Segoe UI"', 'sans-serif'],
        sans: ['system-ui', '-apple-system', '"Heebo"', '"Segoe UI"', 'sans-serif'],
        mono: ['system-ui', '-apple-system', '"Heebo"', 'sans-serif'],
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
