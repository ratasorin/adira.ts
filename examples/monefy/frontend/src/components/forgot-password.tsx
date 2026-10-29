import { expectSuccess } from "../services/api";
import { useState } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { displayError } from "../utils/handle-error";
import { addToast } from "@heroui/toast";
import { api } from "../services/api";
interface ForgotPasswordProps {
    onEmailSent?: () => void;
    onError?: () => void;
}
const forgotPassword = async (email: string) => {
    const { run } = api("/auth/forgot-password", "POST")({ data: { email } });
    try {
        const message = await run().then(expectSuccess).then((res) => {
            return res.message;
        });
        return message;
    }
    catch (err) {
        displayError(err);
    }
};
export default function ForgotPassword({ onEmailSent, onError, }: ForgotPasswordProps) {
    const [email, setEmail] = useState("");
    const handleForgotPassword = async () => {
        try {
            const message = await forgotPassword(email);
            if (message) {
                addToast({
                    color: "success",
                    title: "[Success] Check email for reset link",
                    description: message,
                });
                if (onEmailSent)
                    onEmailSent();
            }
        }
        catch (error) {
            displayError(error);
            if (onError)
                onError();
        }
    };
    return (<Box sx={{ maxWidth: "400px", mx: "auto", p: 3 }}>
      <Typography variant="h6" mb={1}>
        Forgot Password?
      </Typography>
      <TextField fullWidth placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }}/>
      <Button variant="contained" onClick={handleForgotPassword} fullWidth>
        Send Reset Link
      </Button>
    </Box>);
}
