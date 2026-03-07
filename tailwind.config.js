/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef7ed',
          100: '#fdecd4',
          200: '#fad5a8',
          300: '#f6b871',
          400: '#f19038',
          500: '#ee7512',
          600: '#df5b08',
          700: '#b94309',
          800: '#93350e',
          900: '#772e0f',
        },
        dark: '#1a1a2e',
        surface: '#f8f7f4',
      },
    },
  },
  plugins: [],
};
