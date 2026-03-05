/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#22C55E", // Vibrant Green
        "background-light": "#F3F4F6", // Light Gray
        "background-dark": "#0B1120", // Dark Navy Blue
        "text-light": "#1F2937", // Dark Gray Text for Light Mode
        "text-dark": "#E5E7EB", // Light Gray Text for Dark Mode
        "subtle-light": "#6B7280", // Medium Gray for Light Mode
        "subtle-dark": "#9CA3AF", // Medium Gray for Dark Mode
        "surface-dark": "#161D2B", // A slightly lighter dark for surfaces
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem", // 8px
        lg: "0.75rem", // 12px
        xl: "1rem", // 16px
      },
    },
  },
  plugins: [],
}
