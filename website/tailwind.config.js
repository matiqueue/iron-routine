/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#000000',
        surface: '#121214',
        elevated: '#18181A',
        tertiary: '#1C1C1E',
        hairline: '#27272A',
        steel: '#A1A1AA',
        chrome: '#E4E4E7',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glass-card': '0 1px 0 0 rgba(255, 255, 255, 0.05) inset, 0 24px 60px -28px rgba(0, 0, 0, 0.96)',
        'device-frame': '0 0 0 1px #27272A, 0 40px 100px -20px rgba(0, 0, 0, 0.98)',
      },
    },
  },
  plugins: [],
};
