import { useState, useEffect, useRef } from "react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import Link from "@mui/material/Link";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import Icon from "../assets/icon.svg?react";
import SignInIcon from "../assets/singin.svg?react";
import { toast } from "react-toastify";
import ForgotPassword from "../components/forgot-password";
import { Form } from "@heroui/react";
const LoginPage = () => {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const toastShownRef = useRef(false); // Prevent double execution
    useEffect(() => {
        if (searchParams.get("emailSent") === "true" && !toastShownRef.current) {
            toastShownRef.current = true; // Mark as shown
            toast.info("Email sent successfully! Please check inbox");
            // Clone searchParams and remove "emailSent"
            const newParams = new URLSearchParams(searchParams);
            newParams.delete("emailSent");
            // Update the URL without reloading
            setSearchParams(newParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);
    const handleSubmit = async () => {
        login(email, password).then((result) => {
            if (result)
                navigate("/");
        });
    };
    const [showPassword, setShowPassword] = useState(false);
    const handleTogglePassword = () => {
        setShowPassword((prev) => !prev);
    };
    const [openForgotPassword, setOpenForgotPassword] = useState(false);
    useEffect(() => {
        if (isAuthenticated) {
            navigate("/");
        }
    }, [navigate, isAuthenticated]);
    if (isAuthenticated)
        return null;
    return (<>
      <Dialog open={openForgotPassword} onClose={() => setOpenForgotPassword(false)}>
        <ForgotPassword onEmailSent={() => setOpenForgotPassword(false)} onError={() => setOpenForgotPassword(false)}></ForgotPassword>
      </Dialog>
      <Box className="items-center lg:items-stretch" sx={{
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

          <Form className="pl-0 md:pl-5 lg:pl-16 w-full" style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
        }} onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleSubmit();
        }}>
            <Typography variant="h4" my={3} sx={{
            fontWeight: 600,
            textAlign: "center",
        }}>
              Welcome back!
            </Typography>

            <TextField className="w-full" placeholder={"Email"} type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1 }}/>

            <Box className="w-full" sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "end",
            gap: "4px",
        }}>
              <Link type="button" component="button" onClick={() => setOpenForgotPassword(true)} sx={{
            fontSize: "0.875rem",
            textDecoration: "none",
            cursor: "pointer",
        }}>
                Forgot Password?
              </Link>
              <TextField fullWidth placeholder={"Password"} value={password} type={showPassword ? "text" : "password"} // Toggle between "text" and "password"
     InputProps={{
            endAdornment: (<InputAdornment position="end">
                      <IconButton onClick={handleTogglePassword} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>),
        }} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 3 }}/>
            </Box>

            <Stack direction="column" spacing={2} alignItems="center" className="w-full">
              <Button variant="contained" type="submit" fullWidth>
                Login
              </Button>
            </Stack>
          </Form>
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
      </Box>
    </>);
};
export default LoginPage;
