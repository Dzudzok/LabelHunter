/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: 'var(--navy-900)',
          800: 'var(--navy-800)',
          700: 'var(--navy-700)',
          600: 'var(--navy-600)',
          500: 'var(--navy-500)',
        },
        brand: {
          orange: '#f97316',
          'orange-dark': '#ea6c0a',
        },
        theme: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
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
