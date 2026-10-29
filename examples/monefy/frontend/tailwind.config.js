const { heroui } = require("@heroui/theme");
const primary = {
  DEFAULT: "#009e69",
  foreground: "#ffffff",
  50: "#f0fdf7",
  100: "#dcfced",
  200: "#bbf7da",
  300: "#86efbc",
  400: "#4ade9b",
  500: "#00c07f",
  600: "#009e69",
  700: "#007e54",
  800: "#066344",
  900: "#064e3b",
};
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,scss}",
    "../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: { colors: { primary } },
        dark: {
          colors: {
            primary: { ...primary, DEFAULT: "#00c07f", foreground: "#022c22" },
          },
        },
      },
    }),
  ],
};
