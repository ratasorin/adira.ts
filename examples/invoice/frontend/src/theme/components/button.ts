import { Components } from "@mui/material/styles";
declare module "@mui/material/Button" {
    interface ButtonPropsColorOverrides {
        neutral: true;
    }
}
export const MuiButton: Components["MuiButton"] = {
    defaultProps: {
        sx: {
            boxShadow: "none !important",
        },
    },
    variants: [
        {
            props: { color: "neutral", variant: "contained" },
            style: {
                backgroundColor: "var(--color-neutral-main)", // Light gray
                outline: "2px solid transparent",
                "&:hover": {
                    outline: "2px solid var(--color-neutral-dark)",
                    backgroundColor: "var(--color-neutral-main)",
                },
            },
        },
        {
            props: { color: "neutral", variant: "text" },
            style: {
                backgroundColor: "transparent",
                "&:hover": {
                    backgroundColor: "var(--color-action-hover)",
                },
            },
        },
    ],
};
