import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0b0f',
          900: '#101014',
          850: '#15151a',
          800: '#1a1a21',
          700: '#202028',
        },
        accent: {
          DEFAULT: '#a78bfa',
          soft: 'rgba(167,139,250,0.16)',
        },
      },
      borderRadius: { xl2: '18px' },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
