/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forest: "#183e35",
        paper: "#f5f5f1",
        ink: "#1e2927",
        gold: "#d7b981",
        muted: "#7c8883",
        line: "#e4e6df",
        mist: "#eef0e9",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
        display: ["var(--font-manrope)", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 34px rgba(24, 62, 53, 0.055)",
        float: "0 24px 70px rgba(22, 39, 35, 0.18)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
