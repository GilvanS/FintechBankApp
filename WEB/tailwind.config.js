/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './context/**/*.{ts,tsx}',
        './services/**/*.{ts,tsx}',
        './utils/**/*.{ts,tsx}',
        './hooks/**/*.{ts,tsx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                /* Legacy dark-theme tokens (kept for components not yet restyled) */
                'primary': '#00D18B',
                'background-light': '#f6f8f6',
                'background-dark': '#121212',
                'surface-dark': '#1E1E1E',
                'text-dark': '#E5E7EB',
                'subtle-dark': '#9CA3AF',
                /* Volt Fintech brutalist palette */
                'volt-yellow': '#FFD700',
                'volt-green': '#A2FF00',
                'volt-cream': '#FFED86',
                'volt-white': '#FFFFFF',
                'volt-black': '#000000',
            },
            fontFamily: {
                'display': ['Space Grotesk', 'Manrope', 'sans-serif'],
                'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '0.25rem',
                lg: '0.5rem',
                xl: '0.75rem',
                full: '9999px',
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
};
