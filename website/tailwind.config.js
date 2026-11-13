/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#050506',
        surface: '#0B0B0E',
        elevated: '#121216',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glass-card': '0 1px 0 0 rgba(255, 255, 255, 0.06) inset, 0 24px 64px -24px rgba(0, 0, 0, 0.9)',
        'device-frame': '0 0 0 1px rgba(255, 255, 255, 0.14), 0 40px 100px -20px rgba(0, 0, 0, 0.95)',
      },
    },
  },
  plugins: [],
};
