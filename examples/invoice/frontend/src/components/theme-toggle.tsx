import IconButton from "@mui/material/IconButton";
import { useThemeMode } from "../context/theme";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
export default function ToggleThemeButton() {
    const { isDarkMode, toggleTheme } = useThemeMode();
    return (<IconButton onClick={toggleTheme}>
      {isDarkMode ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
    </IconButton>);
}
