import { Components } from "@mui/material/styles";
declare module "@mui/material/Button" {
    interface ButtonPropsColorOverrides {
        neutral: true;
    }
}
export const MuiButtonBase: Components["MuiButtonBase"] = {
    defaultProps: {
        sx: {
            boxShadow: "none !important",
            borderRadius: "8px",
        },
    },
};
