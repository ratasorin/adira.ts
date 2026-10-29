import { createTheme } from "@mui/material/styles";
import { default as darkThemePalette } from "./dark/palette";
import { default as lightThemePalette } from "./light/palette";
import { MuiButton } from "./components/button";
import { MuiInputBase } from "./components/input-base";
import { MuiMenu } from "./components/menu";
import { MuiButtonBase } from "./components/button-base";
import { MuiChip } from "./components/chip";
// https://tailwindcss.com/docs/box-shadow
const shadow_0 = "none" as const;
const shadow_sm = "0 1px 2px 0 rgb(0 0 0 / 0.05)";
const shadow = "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)";
const shadow_md = "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)";
const shadow_lg = "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)";
const shadow_xl = "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)";
const shadow_2xl = "0 25px 50px -12px rgb(0 0 0 / 0.25)";
const shadows = [
    shadow_0,
    shadow_sm,
    shadow,
    shadow_md,
    shadow_lg,
    shadow_xl,
    shadow_2xl,
    ...Array.from({ length: 18 }).map(() => shadow_2xl),
];
export const lightTheme = createTheme({
    palette: lightThemePalette,
    shape: {
        borderRadius: 8, // 8px border radius
    },
    components: {
        MuiButton,
        MuiInputBase,
        MuiMenu,
        MuiButtonBase,
        MuiChip,
    },
    typography: {
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    // @ts-expect-error: The Material UI "shadows" require 25 elements, but the shadow variable cannot prove it has exactly 25 elements, hence typescript will complain
    shadows,
});
export const darkTheme = createTheme({
    palette: darkThemePalette,
    shape: {
        borderRadius: 8,
    },
    components: {
        MuiButton,
        MuiInputBase,
        MuiMenu,
        MuiButtonBase,
        MuiChip,
    },
    typography: {
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    // @ts-expect-error: The Material UI "shadows" require 25 elements, but the shadow variable cannot prove it has exactly 25 elements, hence typescript will complain
    shadows,
});
