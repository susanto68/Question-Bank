/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050816',
        mist: 'rgba(255,255,255,0.08)',
        cyanGlow: '#32d9f7',
        ember: '#ffb86b',
      },
      boxShadow: {
        glass: '0 24px 80px rgba(0, 0, 0, 0.38)',
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
