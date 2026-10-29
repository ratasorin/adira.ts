import { heroui } from "@heroui/theme";
const green = {
  50: "#f4f8f6", 100: "#e6efea", 200: "#d0dfd6", 300: "#aec8ba",
  400: "#83aa97", 500: "#598c75", 600: "#3f725c", 700: "#315b49",
  800: "#28493c", 900: "#223c32",
};
export default heroui({ themes: {
  light: { colors: { primary: { ...green, DEFAULT: "#3f725c", foreground: "#ffffff" }, secondary: { ...green, DEFAULT: "#3f725c", foreground: "#ffffff" }, focus: "#598c75" } },
  dark: { colors: { primary: { ...green, DEFAULT: "#83aa97", foreground: "#112219" }, secondary: { ...green, DEFAULT: "#83aa97", foreground: "#112219" }, focus: "#83aa97" } },
} });
