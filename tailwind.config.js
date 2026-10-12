/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./admin.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quest: {
          bg: "#060e19",
          surface: "#0c1e33",
          card: "#0d223a",
          cardHover: "#122c4b",
          border: "#183658",
          borderGlow: "#254e7d",
          accent: "#38efbf",
          accentHover: "#2dd4a6",
          accentDark: "#0c3b31",
          cyan: "#38bdf8",
          textMuted: "#8da2b5",
          danger: "#f43f5e",
          dangerBg: "rgba(244, 63, 94, 0.15)",
          warning: "#f59e0b",
          success: "#10b981",
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 25px -5px rgba(56, 239, 191, 0.3)',
        'glow-card': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
      }
    },
  },
  plugins: [],
}
