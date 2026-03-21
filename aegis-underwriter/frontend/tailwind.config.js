/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aegis: {
          green: "#00FF9D",
          dark: "#0A0A0A",
          panel: "rgba(20, 20, 20, 0.7)"
        }
      }
    },
  },
  plugins: [],
}
