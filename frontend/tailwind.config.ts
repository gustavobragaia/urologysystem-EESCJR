import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0067CD', dark: '#0052A4', foreground: '#FFFFFF' },
        brand: { DEFAULT: '#193667', foreground: '#FFFFFF' },
        secondary: { DEFAULT: '#004080', foreground: '#FFFFFF' },
        danger: { DEFAULT: '#E54C38', dark: '#D84532', foreground: '#FFFFFF' },
        body: '#38464B',
        title: '#232429',
        muted: { DEFAULT: '#f7f8f9', foreground: '#6c757d' },
        border: '#dfe2e5',
        background: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['0.875rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '8px',
      },
      transitionTimingFunction: {
        DEFAULT: 'ease-in-out',
      },
      transitionDuration: {
        DEFAULT: '300ms',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
