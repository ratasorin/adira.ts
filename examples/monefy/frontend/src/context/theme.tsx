import { createContext, useContext, useState, ReactNode, useEffect, } from "react";
type ThemeContextType = {
    isDarkMode: boolean;
    toggleTheme: () => void;
};
const ThemeContext = createContext<ThemeContextType>({
    isDarkMode: false,
    toggleTheme: () => { },
});
type ThemeProviderProps = {
    children: ReactNode;
};
export function ThemeProvider({ children }: ThemeProviderProps) {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const toggleTheme = () => {
        setIsDarkMode((prev) => !prev);
    };
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
        }
        else {
            document.documentElement.classList.add("light");
            document.documentElement.classList.remove("dark");
        }
    }, [isDarkMode]);
    return (<ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>);
}
// Custom hook to use the ThemeContext
export function useThemeMode() {
    return useContext(ThemeContext);
}
