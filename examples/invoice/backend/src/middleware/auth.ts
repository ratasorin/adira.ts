import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";
import User from "../models/User";

export const protectRoute = (roles: string[] = []): RequestHandler => async (req, res, next) => {
    let id: string;
    try {
        const claims = jwt.verify(req.cookies?.token || "", config.jwt, { algorithms: ["HS256"] });
        if (typeof claims === "string" || claims.purpose !== "session" || typeof claims.id !== "string" || !/^[a-f\d]{24}$/i.test(claims.id)) throw new Error("Invalid session");
        id = claims.id;
    } catch {
        res.status(401).json({ message: "Not authenticated" });
        return;
    }
    try {
        const user = await User.findOne({ _id: id, deletedAt: null, isVerified: true }).select({ role: 1 }).lean();
        if (!user) {
            res.status(401).json({ message: "Account unavailable" });
            return;
        }
        if (roles.length && !roles.includes(user.role)) {
            res.status(403).json({ message: "Not authorized" });
            return;
        }
        req.user = { id, role: user.role };
        next();
    } catch (error) { next(error); }
};
