import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'deep-sea': '#001628',
        'midnight': '#000C17',
        'ice': '#99D9D9',
        'ice-muted': '#68A2B9',
        'success': '#6bffb8',
        'warning': '#ffd666',
        'error': '#ff6b6b',
      },
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['Geist', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
