/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f23',
        surface: '#1a1a3e',
        purple: { DEFAULT: '#8b5cf6', light: '#a78bfa' },
        cyan: { DEFAULT: '#06b6d4', light: '#67e8f9' },
      },
    },
  },
  plugins: [],
};
