/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Workspace palette (Notion-style document UI): warm-white canvas,
        // warm near-black ink, soft hairlines, one blue for actions.
        bg: '#ffffff', // page canvas
        surface: '#f7f7f5', // sidebar / subtle fills
        'surface-2': '#fbfbfa', // hover fill
        border: '#ededeb', // hairline
        ink: '#37352f',
        muted: '#787774',
        faint: '#91918e',
        accent: '#2383e2', // links, primary action
        'accent-2': '#1a73c8',
        // Trading semantics — muted green / red that read well on white.
        win: '#448361',
        loss: '#c4554d',
        tile: '#37352f',
        // Tag (select-property) colours: bg + text pairs.
        tag: {
          gray: '#e3e2e0', 'gray-fg': '#32302c',
          brown: '#eee0da', 'brown-fg': '#442a1e',
          orange: '#fadec9', 'orange-fg': '#49290e',
          yellow: '#fdecc8', 'yellow-fg': '#402c1b',
          green: '#dbeddb', 'green-fg': '#1c3829',
          blue: '#d3e5ef', 'blue-fg': '#183347',
          purple: '#e8deee', 'purple-fg': '#412454',
          pink: '#f5e0e9', 'pink-fg': '#4c2337',
          red: '#ffe2dd', 'red-fg': '#5d1715',
        },
      },
      fontFamily: {
        display: ['"Noto Sans Hebrew"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Noto Sans Hebrew"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
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
