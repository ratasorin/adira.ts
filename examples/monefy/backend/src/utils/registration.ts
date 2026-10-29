import crypto from "crypto";
import jwt from "jsonwebtoken";
import Token from "../models/Token";
import User from "../models/User";
import bcrypt from "bcryptjs";
import { ApiError } from "./api-errors";
const isValidPassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    return passwordRegex.test(password);
};
export const issueToken = async (user: {
    _id: string;
}) => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationToken = jwt.sign({ rawToken }, process.env.JWT_SECRET!, { expiresIn: "1d" });
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await Token.create({
        user: user._id,
        token: tokenHash,
        purpose: "invite",
        isUsed: false,
    });
    return emailVerificationToken;
};
export const decodeToken = (jsonToken: string) => {
    try {
        const { rawToken } = jwt.verify(jsonToken, process.env.JWT_SECRET!) as {
            rawToken: string;
        };
        return crypto.createHash("sha256").update(rawToken).digest("hex");
    }
    catch (err) {
        throw new ApiError(400, "Invalid or expired token.", "INVALID_TOKEN");
    }
};
export const verifyPassword = (password: string) => {
    if (!isValidPassword(password)) {
        throw new ApiError(400, "Password must be at least 6 characters long, include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.", "INVALID_PASSWORD");
    }
    return;
};
export const userExists = async (email: string) => {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        const existingToken = await Token.findOne({ user: existingUser._id });
        if (existingToken) {
            throw new ApiError(409, "User already signed up, please check your email.", "USER_ALREADY_SIGNED_UP");
        }
        throw new ApiError(409, "Email already in use.", "EMAIL_IN_USE");
    }
    return;
};
export const hashPassword = async (password: string) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
};
