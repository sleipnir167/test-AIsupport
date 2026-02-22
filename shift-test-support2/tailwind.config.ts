import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        shift: {
          950: '#0a1628',
          900: '#0f2044',
          800: '#1E4D7B',
          700: '#2563a8',
          600: '#3b7dd8',
          500: '#4472C4',
          400: '#6b9fd4',
          300: '#93c5fd',
          200: '#bfdbfe',
          100: '#e8f2fd',
          50:  '#f0f7ff',
        },
        accent: {
          600: '#0e7490',
          500: '#0891b2',
          400: '#22d3ee',
        }
      },
      fontFamily: {
        sans: ['var(--font-noto)', 'Noto Sans JP', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'progress': 'progress 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        progress: { '0%': { width: '0%' }, '100%': { width: '100%' } },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        'card-hover': '0 4px 12px 0 rgba(30,77,123,0.15)',
        'modal': '0 20px 60px rgba(0,0,0,0.3)',
      }
    },
  },
  plugins: [],
}
export default config
