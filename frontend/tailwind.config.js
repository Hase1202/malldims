/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#0504AA',
        'primary-light': '#DADAF3',
        'primary-dark': '#030260',
        'gray-text': '#646464',
        'dark-text': '#2C2C2C', 
        'light-border': '#EBEAEA',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
