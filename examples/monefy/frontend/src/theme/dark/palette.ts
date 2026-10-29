import type { PaletteOptions } from "@mui/material/styles";
import { green, red } from "@mui/material/colors";
const white = "#FFFFFF";
const black = "#000000";
const MAIN_COLORS = {
    50: "#f4f8f6",
    100: "#e6efea",
    200: "#d0dfd6",
    300: "#aec8ba",
    400: "#83aa97",
    500: "#598c75",
    600: "#3f725c",
    700: "#315b49",
    800: "#28493c",
    900: "#223c32",
    950: "#112219",
};
const ORANGES = {
    50: "#fff9ec",
    100: "#fff3d3",
    200: "#ffe3a5",
    300: "#ffcd6d",
    400: "#ffab32",
    500: "#ff900a",
    600: "#ff7800",
    700: "#cc5702",
    800: "#a1430b",
    900: "#82390c",
    950: "#461a04",
};
const BLUES = {
    50: "#f0f6fe",
    100: "#deeafb",
    200: "#c5dcf8",
    300: "#9dc7f3",
    400: "#62a0ea",
    500: "#4c87e5",
    600: "#376bd9",
    700: "#2e57c7",
    800: "#2c48a1",
    900: "#284080",
    950: "#1d284e",
};
const GRAY = {
    50: "#f7f7f7",
    100: "#ededed",
    200: "#dedede",
    300: "#c8c8c8",
    400: "#adadad",
    500: "#999999",
    600: "#888888",
    700: "#7b7b7b",
    800: "#676767",
    900: "#545454",
    950: "#363636",
};
const palette: PaletteOptions = {
    mode: "dark",
    common: {
        black,
        white,
    },
    neutral: {
        contrastText: white,
        light: GRAY[800],
        main: GRAY[900],
        dark: GRAY[950],
    },
    primary: {
        contrastText: "rgba(0, 0, 0, 0.87)",
        dark: MAIN_COLORS[400],
        main: MAIN_COLORS[300],
        light: MAIN_COLORS[200],
    },
    secondary: {
        contrastText: MAIN_COLORS[900],
        dark: MAIN_COLORS[300],
        main: MAIN_COLORS[200],
        light: MAIN_COLORS[100],
    },
    success: {
        contrastText: "rgba(0, 0, 0, 0.87)",
        dark: green[300],
        main: green[200],
        light: green[100],
    },
    info: {
        contrastText: "rgba(0, 0, 0, 0.87)",
        dark: BLUES[300],
        main: BLUES[200],
        light: BLUES[100],
    },
    warning: {
        contrastText: "rgba(0, 0, 0, 0.87)",
        dark: ORANGES[300],
        main: ORANGES[200],
        light: ORANGES[100],
    },
    error: {
        contrastText: "rgba(0, 0, 0, 0.87)",
        dark: red[300],
        main: red[200],
        light: red[100],
    },
    text: {
        primary: "#ffffff",
        secondary: "rgba(255, 255, 255, 0.55)",
        disabled: "rgba(255, 255, 255, 0.4)",
    },
    divider: "rgba(255, 255, 255, 0.12)",
    action: {
        // these control the text
        active: "#ffffff",
        hover: "rgba(255, 255, 255, 0.05)",
        selected: "rgba(255, 255, 255, 0.10)",
        disabled: "rgba(255, 255, 255, 0.2)",
        disabledBackground: "rgba(255, 255, 255, 0.1)",
        focus: "rgba(255, 255, 255, 0.15)",
        // these control the background
        hoverOpacity: 0.1,
        selectedOpacity: 0.1,
        disabledOpacity: 0.25,
        focusOpacity: 0.15,
        activatedOpacity: 0.15,
    },
    background: {
        default: "#222",
        paper: "#222",
    },
    grey: GRAY,
};
export default palette;
