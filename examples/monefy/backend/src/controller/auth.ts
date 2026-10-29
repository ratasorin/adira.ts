import { type Json, json } from "../types/json";
import { ApiError } from "../utils/api-errors";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import User from "../models/User";
import Token from "../models/Token";
import { config, development } from "../config/env";
import type { ReturnResponse } from "../types";
const passwordRule = z
    .string()
    .min(10)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/);
const emailRule = z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase());
const secure = config.publicOrigin.startsWith("https://");
const cookie = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
async function sendToken(user: {
    _id: unknown;
    email: string;
}, purpose: "verify" | "reset") {
    const rawToken = randomBytes(32).toString("hex");
    await Token.create({ user: user._id, token: hash(rawToken), purpose });
    const page = purpose === "verify" ? "verify-email" : "reset-password";
    const link = `${config.publicOrigin}/${page}?token=${rawToken}`;
    const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "mailpit",
        port: Number(process.env.SMTP_PORT || 1025),
        secure: process.env.SMTP_SECURE === "true",
        ...(process.env.SMTP_USER
            ? {
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                },
            }
            : {}),
    });
    await transport.sendMail({
        from: process.env.MAIL_FROM || "Monefy <noreply@monefy.ro>",
        to: user.email,
        subject: purpose === "verify"
            ? "Monefy: verify your email"
            : "Monefy: reset your password",
        text: `Open this link to ${purpose === "verify" ? "verify your email" : "reset your password"}: ${link}\nThis link expires in one hour.`,
    });
}
export const register = async (req: Request<never, never, Json<{
    username: string;
    email: string;
    password: string;
}>, {}>, res: Response<Json<ReturnResponse>>) => {
    const body = z
        .object({
        username: z.string().trim().min(2).max(80),
        email: emailRule,
        password: passwordRule,
    })
        .parse(req.body);
    const emailDomain = (process.env.REGISTRATION_EMAIL_DOMAIN || "monefy.ro").toLowerCase();
    if (!body.email.endsWith(`@${emailDomain}`)) {
        res.status(400).json(json({ message: `Use your ${emailDomain} work email` }));
        return;
    }
    if (await User.exists({ email: body.email })) {
        res
            .status(409)
            .json({ message: "An account already exists for this email" });
        return;
    }
    const user = await User.create({
        ...body,
        password: await bcrypt.hash(body.password, 12),
        isVerified: false,
    });
    await sendToken(user, "verify");
    res
        .status(201)
        .json({ message: "Check your email to verify your Monefy account" });
};
export interface Account {
    id: string;
    username: string;
    email: string;
    role: "BASIC" | "ADVANCED";
}
export const login = async (req: Request<never, never, Json<{
    email: string;
    password: string;
}>, {}>, res: Response<Json<Account>>) => {
    const body = z.object({ email: emailRule, password: z.string().max(128) }).parse(req.body);
    const user = await User.findOne({ email: body.email, deletedAt: null });
    if (!user || !user.password || !await bcrypt.compare(body.password, user.password))
        throw new ApiError(401, "Invalid credentials");
    if (!user.isVerified)
        throw new ApiError(403, "Please verify your email before logging in");
    const token = jwt.sign({ id: String(user._id), role: user.role, purpose: "session" }, config.jwt, { algorithm: "HS256", expiresIn: "10h" });
    res.cookie("token", token, { ...cookie, maxAge: 36000000 });
    res.json(json({ id: String(user._id), username: user.username, email: user.email, role: user.role }));
};
export const logout = (_req: Request<never, never, {}, {}>, res: Response<Json<ReturnResponse>>) => {
    res.clearCookie("token", cookie);
    res.json(json({ message: "Logged out successfully" }));
};
export const getMe = async (req: Request<never, never, never, {}>, res: Response<Json<Account>>) => {
    const user = await User.findOne({ _id: req.user!.id, deletedAt: null }).lean();
    if (!user)
        throw new ApiError(401, "Account unavailable");
    res.json(json({ id: String(user._id), username: user.username, email: user.email, role: user.role }));
};
export const forgotPassword = async (req: Request<never, never, Json<{
    email: string;
}>, {}>, res: Response<Json<ReturnResponse>>) => {
    const { email } = z.object({ email: emailRule }).parse(req.body);
    const user = await User.findOne({ email });
    if (user)
        await sendToken(user, "reset");
    res.json(json({ message: "If that account exists, a reset link has been sent" }));
};
async function consumeToken(rawToken: string, purpose: string) {
    const token = await Token.findOneAndUpdate({
        token: hash(rawToken),
        purpose,
        isUsed: false,
        createdAt: { $gt: new Date(Date.now() - 3600000) },
    }, { $set: { isUsed: true } }, { new: true });
    if (!token)
        throw Object.assign(new Error("Invalid or expired token"), { status: 400 });
    return token;
}
export const verifyEmail = async (req: Request<never, never, {}, {
    token: string;
}>, res: Response<Json<ReturnResponse>>) => {
    const raw = z.string().length(64).parse(req.query.token);
    const token = await consumeToken(raw, "verify");
    await User.findByIdAndUpdate(token.user, { isVerified: true });
    res.json(json({ message: "Your Monefy email is verified" }));
};
export const resetPassword = async (req: Request<never, never, Json<{
    token: string;
    newPassword: string;
}>, {}>, res: Response<Json<ReturnResponse>>) => {
    const { token: raw, newPassword } = z
        .object({ token: z.string().length(64), newPassword: passwordRule })
        .parse(req.body);
    const token = await consumeToken(raw, "reset");
    await User.findByIdAndUpdate(token.user, {
        password: await bcrypt.hash(newPassword, 12),
    });
    res.json(json({ message: "Password reset successfully" }));
};
