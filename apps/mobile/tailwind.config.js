/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './features/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background palette (dark theme)
        background: {
          DEFAULT: '#0f172a',
          card: '#1e293b',
          elevated: '#334155',
        },
        // Primary — neon yellow (brand)
        primary: {
          DEFAULT: '#FFD60A',
          dim: '#B89B00',
          light: '#FFF176',
        },
        // Status colours
        verified: {
          DEFAULT: '#22c55e',
          dim: '#15803d',
        },
        pending: {
          DEFAULT: '#f59e0b',
          dim: '#b45309',
        },
        rejected: {
          DEFAULT: '#ef4444',
          dim: '#b91c1c',
        },
        // Text
        content: {
          DEFAULT: '#f8fafc',
          muted: '#94a3b8',
          subtle: '#475569',
        },
        // Parking type
        parking: {
          public: '#FFD60A',
          private: '#374151',
        },
        // Surface and border
        surface: {
          DEFAULT: '#1e293b',
          2: '#334155',
          3: '#475569',
        },
        border: {
          DEFAULT: '#334155',
          focus: '#FFD60A',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
      borderRadius: {
        card: '12px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};
