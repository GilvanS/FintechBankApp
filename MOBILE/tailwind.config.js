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
        /* Legacy tokens mobile (backward compat com componentes antigos) */
        primary: "#00e38b",
        "background-light": "#f6f8f6",
        "background-dark": "#131313",
        "text-light": "#1F2937",
        "text-dark": "#e5e2e1",
        "subtle-light": "#6B7280",
        "subtle-dark": "#b9cbbc",
        "surface-dark": "#201f1f",
        /* ── Midnight Dark tokens ── */
        "volt-primary":       "#00ff9d", /* primary — neon green */
        "volt-primary-dark":  "#00e38b", /* primary-fixed-dim */
        "volt-dark":          "#131313", /* background — void backdrop */
        "volt-surface":       "#201f1f", /* surface-container — cards */
        "volt-surface-low":   "#1c1b1b", /* surface-container-low */
        "volt-surface-high":  "#2a2a2a", /* surface-container-high */
        "volt-surface-top":   "#353534", /* surface-container-highest */
        "volt-white":         "#e5e2e1", /* on-surface */
        "volt-muted":         "#b9cbbc", /* on-surface-variant */
        "volt-black":         "#000000",
        "volt-green":         "#00ff9d", /* alias for primary accent */
        /* ── Yellow Brutalist tokens ── */
        "volt-yellow":        "#FFD700", /* background — vibrant yellow */
        "volt-yellow-pastel": "#FFED86", /* surface-high — pastel cream */
        "volt-lime":          "#A2FF00", /* primary — vibrant lime */
        "volt-cyan":          "#00E5FF", /* secondary button */
        "volt-pink-focus":    "#FF5C8D", /* input focus border */
        /* Semantic tokens */
        "on-surface":         "#e5e2e1",
        "on-surface-variant": "#b9cbbc",
        "neon-secondary":     "#c9bfff", /* atmospheric purple */
        "neon-outline":       "#849587",
        "neon-error":         "#ffb4ab",
      },
      fontFamily: {
        display: ["Space Grotesk", "Manrope", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}
