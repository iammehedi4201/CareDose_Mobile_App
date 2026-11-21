/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#087E67',
          dark: '#075D4E',
        },
        mint: '#EAF7F1',
        background: '#F7FAF8',
        success: '#16815B',
        warning: '#CB881F',
        error: '#CC5650',
        info: '#538BCF',
        border: '#E4ECE7',
        main: '#18312D',
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        6: '24px',
        8: '32px',
      },
      borderRadius: {
        card: '16px',
        field: '12px',
      },
    },
  },
  plugins: [],
};
