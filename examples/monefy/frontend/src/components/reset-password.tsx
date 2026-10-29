import { expectSuccess } from "../services/api";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { displayError, } from "../utils/handle-error";
import { api } from "../services/api";
import { addToast } from "@heroui/toast";
const isValidPassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    return passwordRegex.test(password);
};
const resetPassword = (newPassword: string, token: string) => {
    const { run } = api("/auth/reset-password", "POST")({ data: { newPassword, token } });
    return run().then(expectSuccess).then((res) => {
        return res.message;
    });
};
export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
    const [passwordTouched, setPasswordTouched] = useState(false); // Tracks if the user stopped typing
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const handleTogglePassword = () => setShowPassword((prev) => !prev);
    const handleToggleConfirmPassword = () => setShowConfirmPassword((prev) => !prev);
    const navigate = useNavigate();
    const handleResetPassword = async () => {
        if (!isValidPassword(newPassword)) {
            setPasswordError("Password must be at least 6 characters long, include 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setConfirmPasswordError("Passwords do not match.");
            return;
        }
        try {
            if (!token) {
                addToast({
                    title: "[Error] Missing token!",
                    description: "The token needed to reset password is missing",
                    color: "danger",
                });
                return;
            }
            const message = await resetPassword(newPassword, token);
            if (message) {
                addToast({
                    title: "[Success] Password reset",
                    description: message,
                    color: "success",
                });
                navigate("/login");
            }
        }
        catch (error) {
            displayError(error);
        }
    };
    return (<Box sx={{ maxWidth: "400px", mx: "auto", mt: 8 }}>
      <Typography variant="h5" mb={2}>
        Reset Password
      </Typography>

      {/* New Password Field */}
      <TextField fullWidth placeholder="New Password" value={newPassword} type={showPassword ? "text" : "password"} InputProps={{
            endAdornment: (<InputAdornment position="end">
              <IconButton onClick={handleTogglePassword} edge="end">
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>),
        }} onChange={(e) => {
            setNewPassword(e.target.value);
            setPasswordTouched(true);
            setPasswordError(null); // Clear error when user types
        }} onBlur={() => {
            if (!isValidPassword(newPassword)) {
                setPasswordError("Password must be at least 6 characters long, include 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.");
            }
        }} error={passwordTouched && !!passwordError} helperText={passwordTouched ? passwordError : ""} sx={{ mb: 2 }}/>

      {/* Confirm Password Field */}
      <TextField fullWidth placeholder="Confirm Password" value={confirmPassword} type={showConfirmPassword ? "text" : "password"} InputProps={{
            endAdornment: (<InputAdornment position="end">
              <IconButton onClick={handleToggleConfirmPassword} edge="end">
                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>),
        }} onChange={(e) => {
            setConfirmPassword(e.target.value);
            setConfirmPasswordError(null); // Clear error when user types
        }} onBlur={() => {
            if (newPassword !== confirmPassword) {
                setConfirmPasswordError("Passwords do not match.");
            }
        }} error={!!confirmPasswordError} helperText={confirmPasswordError} sx={{ mb: 2 }}/>

      {/* Reset Password Button */}
      <Button variant="contained" onClick={handleResetPassword} fullWidth disabled={!newPassword ||
            !confirmPassword ||
            newPassword !== confirmPassword ||
            !isValidPassword(newPassword)}>
        Reset Password
      </Button>
    </Box>);
}
