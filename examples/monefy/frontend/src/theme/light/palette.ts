import type { PaletteColor, PaletteColorOptions, PaletteOptions, } from "@mui/material/styles";
import { green, red } from "@mui/material/colors";
const white = "#FFFFFF";
const black = "#000000";
declare module "@mui/material/styles" {
    interface Palette {
        neutral: PaletteColor;
    }
    interface PaletteOptions {
        neutral?: PaletteColorOptions;
    }
}
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
    mode: "light",
    common: {
        black,
        white,
    },
    neutral: {
        contrastText: black,
        light: white,
        main: GRAY[100],
        dark: GRAY[200],
    },
    primary: {
        contrastText: white,
        dark: MAIN_COLORS[800],
        main: MAIN_COLORS[700],
        light: MAIN_COLORS[600],
    },
    secondary: {
        contrastText: MAIN_COLORS[900],
        dark: MAIN_COLORS[200],
        main: MAIN_COLORS[100],
        light: MAIN_COLORS[50],
    },
    success: {
        contrastText: white,
        dark: green[700],
        main: green[600],
        light: green[500],
    },
    info: {
        contrastText: white,
        dark: BLUES[700],
        main: BLUES[600],
        light: BLUES[500],
    },
    warning: {
        contrastText: white,
        dark: ORANGES[700],
        main: ORANGES[600],
        light: ORANGES[500],
    },
    error: {
        contrastText: white,
        dark: red[700],
        main: red[600],
        light: red[500],
    },
    text: {
        primary: "rgba(0, 0, 0, 0.9)",
        secondary: "rgba(0, 0, 0, 0.55)",
        disabled: "rgba(0, 0, 0, 0.4)",
    },
    divider: "rgba(0, 0, 0, 0.12)",
    action: {
        // these control the text
        active: "rgba(0, 0, 0, 0.55)",
        hover: "rgba(0, 0, 0, 0.05)",
        selected: "rgba(0, 0, 0, 0.10)",
        disabled: "rgba(0, 0, 0, 0.2)",
        disabledBackground: "rgba(0, 0, 0, 0.1)",
        focus: "rgba(0, 0, 0, 0.15)",
        // these control the background
        hoverOpacity: 0.1,
        selectedOpacity: 0.1,
        disabledOpacity: 0.25,
        focusOpacity: 0.15,
        activatedOpacity: 0.15,
    },
    background: {
        default: white,
        paper: white,
    },
    grey: GRAY,
};
export default palette;
