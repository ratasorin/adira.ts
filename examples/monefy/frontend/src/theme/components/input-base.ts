import { Components } from "@mui/material/styles";
export const MuiInputBase: Components["MuiInputBase"] = {
    styleOverrides: {
        root: {
            "& .MuiOutlinedInput-input": {
                padding: "8px 12px",
            },
        },
    },
};
