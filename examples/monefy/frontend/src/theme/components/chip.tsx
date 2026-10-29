import { Components } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
export const MuiChip: Components["MuiChip"] = {
    defaultProps: {
        sx: {
            fontFamily: "inherit !important",
            height: "auto !important",
            borderRadius: "6px !important",
            border: "1px solid var(--color-divider)",
            fontWeight: 600,
        },
        deleteIcon: <CloseRoundedIcon sx={{ fontSize: "18px !important" }}/>,
    },
    variants: [
        {
            props: {
                variant: "filled",
                color: "default",
            },
            style: {
                backgroundColor: "var(--color-action-hover)",
            },
        },
    ],
    styleOverrides: {
        label: ({ ownerState }: any) => {
            return {
                ...(ownerState.size === "small" && {
                    padding: "4px 8px !important",
                }),
                ...(ownerState.size === "medium" && {
                    padding: "6px 12px !important",
                }),
            };
        },
    },
};
