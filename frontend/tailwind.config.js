/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101214",
        panel: "#181c20",
        line: "#2a3036",
        faceit: "#ff5500",
        aqua: "#19d3c5",
      },
    },
  },
  plugins: [],
};
