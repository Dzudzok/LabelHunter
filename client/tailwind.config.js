/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0f1923',
          800: '#1a2332',
          700: '#243447',
          600: '#2e4560',
        },
        brand: {
          orange: '#f97316',
          'orange-dark': '#ea6c0a',
        }
      },
      fontSize: {
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
      }
    },
  },
  plugins: [],
}
