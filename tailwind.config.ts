import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0b9c9',
          400: '#8592aa',
          500: '#65738e',
          600: '#505c75',
          700: '#424b5f',
          800: '#394050',
          900: '#181c25',
          950: '#0e1117',
        },
        brand: {
          50: '#eef4ff',
          100: '#dae6ff',
          200: '#bdd3ff',
          300: '#8fb6ff',
          400: '#5a8eff',
          500: '#3466f6',
          600: '#2049eb',
          700: '#1a39d8',
          800: '#1c31af',
          900: '#1c2f8a',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.10)',
        pop: '0 12px 32px -8px rgb(16 24 40 / 0.20)',
      },
    },
  },
  plugins: [],
};

export default config;
