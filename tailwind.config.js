/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          night: '#0A0F1E',
          electric: '#3B82F6',
          mist: '#E5F1FF',
        },
      },
      boxShadow: {
        glow: '0 0 25px rgba(59, 130, 246, 0.45)',
        glass: '0 20px 60px rgba(10, 15, 30, 0.45)',
      },
      backgroundImage: {
        'city-grid':
          'linear-gradient(rgba(59,130,246,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.18) 1px, transparent 1px)',
      },
      keyframes: {
        drift: {
          '0%': { transform: 'translate3d(0,0,0)' },
          '100%': { transform: 'translate3d(0, -32px, 0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.25' },
          '50%': { opacity: '0.65' },
        },
      },
      animation: {
        drift: 'drift 12s linear infinite',
        pulseSoft: 'pulseSoft 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
