import { Components } from "@mui/material/styles";
export const MuiMenu: Components["MuiMenu"] = {
    styleOverrides: {
        list: {
            padding: "8px",
            borderRadius: "12px",
            "& .MuiMenuItem-root + .MuiMenuItem-root": {
                marginTop: "2px",
            },
        },
    },
};
