import { ChangeEventHandler, Dispatch, FC, SetStateAction, useCallback, useState, } from "react";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
const PasswordInput: FC<{
    password: string;
    setPassword: Dispatch<SetStateAction<string>>;
    passwordErrors: string[];
    setPasswordErrors: Dispatch<SetStateAction<string[]>>;
    validator: (s: string) => string[];
    placeholder?: string;
}> = ({ password, setPassword, validator, passwordErrors, setPasswordErrors, placeholder, }) => {
    const handlePasswordChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = useCallback((ev) => {
        const value = ev.target.value;
        setPassword(value);
        setPasswordErrors(validator(value));
    }, [setPassword, validator, setPasswordErrors]);
    const [showPassword, setShowPassword] = useState(false);
    const handleTogglePassword = () => {
        setShowPassword((prev) => !prev);
    };
    return (<TextField fullWidth placeholder={placeholder || "Password"} value={password} type={showPassword ? "text" : "password"} InputProps={{
            endAdornment: (<InputAdornment position="end">
            <IconButton onClick={handleTogglePassword} edge="end">
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>),
        }} onChange={handlePasswordChange} error={passwordErrors.length > 0} helperText={passwordErrors.map((err) => (<p>{err}</p>))} sx={{ mb: 3 }}/>);
};
export default PasswordInput;
