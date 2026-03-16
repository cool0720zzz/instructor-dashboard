/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,jsx}'],
  theme: {
    extend: {
      animation: {
        'pulse-danger': 'pulse-danger 1.5s ease-in-out infinite',
      },
      keyframes: {
        'pulse-danger': {
          '0%, 100%': { borderColor: 'rgba(239,68,68,0.7)' },
          '50%': { borderColor: 'rgba(239,68,68,0.3)' },
        },
      },
    },
  },
  plugins: [],
};
