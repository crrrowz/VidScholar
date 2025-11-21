// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: [
    './entrypoints/**/*.{html,ts,tsx}',
    './src/**/*.{html,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3ea6ff',
          hover: '#5eb8ff',
          active: '#2a8ee5',
          contrast: '#ffffff',
        },
        secondary: {
          DEFAULT: '#666666',
          hover: '#777777',
        },
        accent: '#00d4ff',
        success: '#4caf50',
        warning: '#ff9800',
        danger: '#f44336',
        surface: {
          dark: '#1a1a1a',
          DEFAULT: '#2a2a2a',
          elevated: '#333333',
          hover: '#3a3a3a',
        },
        bg: {
          dark: '#0f0f0f',
          DEFAULT: '#1f1f1f',
        },
        text: {
          primary: '#ffffff',
          secondary: '#b3b3b3',
          muted: '#808080',
          disabled: '#4d4d4d',
        },
        border: {
          DEFAULT: '#3d3d3d',
          hover: '#4d4d4d',
          focus: '#3ea6ff',
        },
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.25' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.5' }],
        lg: ['16px', { lineHeight: '1.5' }],
        xl: ['18px', { lineHeight: '1.75' }],
      },
      fontWeight: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.5)',
        lg: '0 10px 25px rgba(0, 0, 0, 0.6)',
        xl: '0 20px 40px rgba(0, 0, 0, 0.7)',
        focus: '0 0 0 3px rgba(62, 166, 255, 0.25)',
      },
      transitionDuration: {
        fast: '120ms',
        base: '200ms',
        slow: '300ms',
      },
      fontFamily: {
        sans: ['Roboto', 'system-ui', '-apple-system', 'sans-serif'],
        ar: ['Noto Sans Arabic', 'Roboto', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Roboto Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};