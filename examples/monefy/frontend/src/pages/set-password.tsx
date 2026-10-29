import { expectSuccess } from "../services/api";
import { useCallback, useEffect } from "react";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/auth";
import SignInIcon from "../assets/singin.svg?react";
import Icon from "../assets/icon.svg?react";
import UnloadCoinAnimation from "../components/Loading/unload";
import PasswordInput from "../components/password-input";
import { addToast } from "@heroui/toast";
import { displayError, } from "../utils/handle-error";
import { usePassword } from "../components/password-input/use-password";
import { api } from "../services/api";
const isValidPassword = (password: string): string[] => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (passwordRegex.test(password))
        return [];
    return [
        "Password must be 6+ chars, 1 uppercase, 1 lowercase, 1 number, 1 special char.",
    ];
};
const doRegister = (newPassword: string, tokenId: string) => {
    const { run } = api("/users/register/:token_id", "POST")({ data: { password: newPassword }, path: { token_id: tokenId } });
    return run().then(expectSuccess).then((res) => {
        return res.message;
    });
};
const SetPassword = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const { firstPassword, firstPasswordError, setfirstPassword, setfirstPasswordError, } = usePassword("first");
    const { secondPassword, secondPasswordError, setsecondPassword, setsecondPasswordError, } = usePassword("second");
    const isSecondPasswordValid = useCallback((password: string) => {
        const err = isValidPassword(password);
        return [
            ...err,
            ...(password === firstPassword ? [] : ["Passwords must match!"]),
        ];
    }, [firstPassword]);
    const isFirstPasswordValid = useCallback((password: string) => isValidPassword(password), []);
    const { isAuthenticated } = useAuth();
    useEffect(() => {
        if (isAuthenticated) {
            navigate("/");
        }
    }, [navigate, isAuthenticated]);
    if (isAuthenticated)
        return <h3>Already authenticated! Redirecting!</h3>;
    return (<Box sx={{
            height: "100vh",
            p: 4,
            display: "flex",
            gap: {
                md: 4,
                sx: 0,
                lg: 8,
            },
            flexDirection: {
                xs: "column",
                md: "row",
            },
        }}>
      <Box sx={{
            maxWidth: "600px",
            display: "flex",
            flexDirection: "column",
            flex: 1,
        }}>
        <div>
          <Button style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
        }}>
            <Icon width={32} height={32}/>
            <span style={{
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--color-primary-dark)",
        }}>
              monefy
            </span>
          </Button>
        </div>

        <Box sx={{
            paddingLeft: {
                md: 5,
                sx: 0,
                lg: 10,
            },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
        }}>
          <Typography variant="h6" sx={{
            color: "text.secondary",
            textAlign: "center",
            lineHeight: 1.4,
        }}>
            Hello there!
          </Typography>

          <Typography variant="h4" my={3} sx={{
            fontWeight: 600,
            textAlign: "center",
        }}>
            Let's set up your account
          </Typography>

          <Stack direction="column" spacing={2} alignItems="center">
            <PasswordInput password={firstPassword} passwordErrors={firstPasswordError} setPassword={setfirstPassword} setPasswordErrors={setfirstPasswordError} validator={isFirstPasswordValid}></PasswordInput>

            <PasswordInput password={secondPassword} passwordErrors={secondPasswordError} setPassword={setsecondPassword} setPasswordErrors={setsecondPasswordError} validator={isSecondPasswordValid} placeholder="Confirm Password"></PasswordInput>

            <Button variant="contained" onClick={() => {
            if (!token) {
                addToast({
                    title: "[Error] Missing token!",
                    description: "The token is missing, cannot set password account!",
                    color: "danger",
                });
                return;
            }
            doRegister(secondPassword, token)
                .then((message) => {
                if (message) {
                    addToast({
                        title: "[Success] Updated user password!",
                        description: message,
                        color: "success",
                    });
                    setTimeout(() => {
                        navigate("/login");
                    }, 500);
                }
            })
                .catch((err) => displayError(err, "[Error] Update user password"));
        }} fullWidth disabled={firstPasswordError.length > 0 ||
            !firstPassword ||
            secondPasswordError.length > 0 ||
            !secondPassword}>
              Click to Register
            </Button>
            <Divider flexItem></Divider>
          </Stack>
        </Box>
      </Box>

      <Box sx={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            padding: "24px",
        }}>
        <Box sx={{
            width: "100%",
            height: "100%",
            position: "absolute",
            backgroundImage: `
              radial-gradient(at 50% 70%, hsla(155,25%,78%,0.45) 0px, transparent 40% 50%),
              radial-gradient(at 70% 30%, hsla(155,25%,78%,0.45) 0px, transparent 50% 50%),
              radial-gradient(at 30% 40%, hsla(155,25%,78%,0.45) 0px, transparent 30% 20%),
              radial-gradient(at 80% 30%, hsla(155,25%,78%,0.45) 0px, transparent 30% 25%)`,
            filter: "blur(70px)",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
        }}></Box>

        <SignInIcon style={{
            zIndex: 1,
            width: "90%",
            height: "90%",
            minWidth: "400px",
            maxWidth: "500px",
        }}></SignInIcon>
      </Box>
    </Box>);
};
export default function CompleteSetPassword() {
    return (<UnloadCoinAnimation>
      <SetPassword />
    </UnloadCoinAnimation>);
}
