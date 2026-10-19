/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b221f',
        paper: '#f7f8f5',
        ground: '#e9ece7',
        line: '#d3d9d2',
        muted: '#5b6761',
        brand: { DEFAULT: '#2c6a57', soft: '#d7e6df' },
        status: { free: '#22c55e', reserved: '#f59e0b', sold: '#9ca3af' },
      },
      fontFamily: {
        display: ['Unbounded', 'Onest', 'system-ui', 'sans-serif'],
        sans: ['Onest', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
