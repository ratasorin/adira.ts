import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import { register, login, logout, getMe, forgotPassword, resetPassword, verifyEmail, } from "../controller/auth";
import { protectRoute } from "../middleware/auth";
export const authRouter = Router();
const routeScope = "/auth";
authRouter.use(routeScope, rateLimit({
    windowMs: 60000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
}));
authRouter.post("/auth/register", register);
authRouter.post("/auth/login", login);
authRouter.post("/auth/logout", logout);
authRouter.get("/auth/me", protectRoute(), getMe);
authRouter.post("/auth/forgot-password", forgotPassword);
authRouter.post("/auth/reset-password", resetPassword);
authRouter.get("/auth/verify-email", verifyEmail);
