/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Obsidian canvas
        bg: '#07090d',
        surface: '#0d1117',
        'surface-2': '#141b24',
        border: '#1d2530',
        muted: '#828d9e',
        // Brand gradient stops
        accent: '#7c5cff',
        'accent-2': '#22d3ee',
        // Trading semantics
        win: '#34d399',
        loss: '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px -20px rgba(124,92,255,0.35)',
        panel: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 30px 60px -30px rgba(0,0,0,0.7)',
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
