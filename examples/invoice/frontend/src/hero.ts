import { heroui } from "@heroui/theme";
const neutral = {
  50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4",
  400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040",
  800: "#262626", 900: "#171717",
};
export default heroui({ themes: {
  light: { colors: { primary: { ...neutral, DEFAULT: "#525252", foreground: "#ffffff" }, secondary: { ...neutral, DEFAULT: "#525252", foreground: "#ffffff" }, focus: "#737373" } },
  dark: { colors: { primary: { ...neutral, DEFAULT: "#a3a3a3", foreground: "#0a0a0a" }, secondary: { ...neutral, DEFAULT: "#a3a3a3", foreground: "#0a0a0a" }, focus: "#a3a3a3" } },
} });
