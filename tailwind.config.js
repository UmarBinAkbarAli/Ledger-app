/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#16a34a", // Green-600
        "primary-dark": "#15803d",
        "primary-light": "#dcfce7",
        "background-light": "#f3f4f6", // Gray-100
        "surface-white": "#ffffff",
        "text-primary": "#111827", // Gray-900
        "text-secondary": "#6b7280", // Gray-500
        "border-light": "#e5e7eb", // Gray-200
      },
      fontFamily: {
        "manrope": ["Manrope", "sans-serif"],
        "display": ["Manrope", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "xl": "1rem",
        "2xl": "1.5rem",
        "full": "9999px",
      },
    },
  },
  plugins: [],
};
