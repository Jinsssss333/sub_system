/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Corporate blue. Used for primary actions, active nav and links.
        primary: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa',
          500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a',
        },
        // Sidebar / brand navy.
        navy: { 700: '#1f2a44', 800: '#172036', 900: '#0f172a', 950: '#0b1120' },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        pop: '0 12px 32px -12px rgb(15 23 42 / 0.3)',
        menu: '0 8px 24px -8px rgb(15 23 42 / 0.25), 0 0 0 1px rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};
