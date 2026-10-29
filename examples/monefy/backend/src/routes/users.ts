import { sendEmail } from "../utils/send-email";
import { config } from "../config/env";
import { type Json, json } from "../types/json";
import { protectInputKeys } from "../middleware/input";
import { Request, Response, Router } from "express";
import User, { IUser } from "../models/User";
import { ErrorResponse } from "../types";
import { protectRoute } from "../middleware/auth";
import { decodeToken, hashPassword, issueToken, verifyPassword, } from "../utils/registration";
import Token from "../models/Token";
import { buildDeleteHandler, buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import { Types } from "mongoose";
import { Backend } from "@n/adira.core.ts";
import { ApiError } from "../utils/api-errors";
import { asyncHandler } from "../middleware/async-handler";
const usersRouter = Router();
const getExecutor = buildGetHandler(User);
const postExecutor = buildPostHandler(User), sanitizePostUserPayload = protectInputKeys([
    "_id",
    "created_by",
    "deletedAt",
    "isAdminCreated",
    "isVerified",
    "deletedAt",
]);
const patchExecutor = buildPatchHandler(User), sanitizePatchUserPayload = protectInputKeys([
    "_id",
    "created_by",
    "deletedAt",
    "isAdminCreated",
    "isVerified",
    "deletedAt",
]);
const deleteExecutor = buildDeleteHandler(User);
export type UserGetExecutor = typeof getExecutor;
export const handleGetUsers = async (req: Request<never, never, never, Backend.InferHandlerParams<UserGetExecutor>>, res: Response<Json<Backend.InferHandlerResponse<UserGetExecutor> | ErrorResponse>>) => {
    try {
        const rows = await getExecutor(req.query);
        res.send(json(rows));
    }
    catch (error) {
        throw error;
    }
};
export type UserPatchExecutor = typeof patchExecutor;
export const handlePatchUser = async (req: Request<{
    id: string;
}, never, Partial<Pick<IUser, "username" | "email" | "role">>, {}>, res: Response<Json<Backend.InferHandlerResponse<UserPatchExecutor> | ErrorResponse>>) => {
    try {
        const row = await patchExecutor(req.params.id, req.query, User.castObject(req.body), {
            createNewRecord: false,
        });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export const handleDeleteUser = async (req: Request<{
    id: string;
}, never, {}, {}>, res: Response<Json<ErrorResponse | {
    error: false;
}>>) => {
    try {
        await deleteExecutor(req.params.id, {}, {
            softDelete: async () => {
                await User.findByIdAndUpdate(new Types.ObjectId(req.params.id), {
                    deletedAt: Date.now(),
                });
            },
        });
        res.send(json({ error: false }));
    }
    catch (error) {
        throw error;
    }
};
export type UsersPostExecutor = typeof postExecutor;
export const handleCreateUser = async (req: Request<never, never, Pick<IUser, "username" | "email" | "role">, Backend.InferHandlerParams<UsersPostExecutor>>, res: Response<Json<Backend.InferHandlerResponse<UsersPostExecutor> | ErrorResponse>>) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized");
        }
        const isUserAdmin = req.user.role === "ADVANCED";
        const row = await postExecutor(req.query, User.castObject({
            ...req.body,
            _id: new Types.ObjectId(),
            created_by: new Types.ObjectId(req.user.id),
            isAdminCreated: isUserAdmin,
            isVerified: false,
            deletedAt: null,
            password: "",
        }));
        const token = await issueToken({ _id: String(row._id) });
        const link = `${config.publicOrigin}/set-password?token=${encodeURIComponent(token)}`;
        await sendEmail({ recipientEmail: req.body.email, subject: "Your Monefy invitation", html: `<p>You have been invited to Monefy.</p><p><a href="${link}">Set your password</a></p><p>This link expires in 24 hours.</p>` });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export const completeRegistration = async (req: Request<{
    token_id: string;
}, never, Json<{
    password: string;
}>, {}>, res: Response<Json<ErrorResponse | {
    message: string;
    error: false;
}>>) => {
    const { token_id } = req.params;
    const password = req.body.password;
    if (!token_id || !req.body.password) {
        throw new ApiError(403, "Missing token or password");
    }
    verifyPassword(password);
    const token = decodeToken(token_id);
    try {
        const foundToken = await Token.findOneAndUpdate({ token, purpose: "invite", isUsed: false, createdAt: { $gt: new Date(Date.now() - 86400000) } }, { $set: { isUsed: true } }, { new: true });
        if (!foundToken) {
            throw new ApiError(403, "No user found for the token sent");
        }
        const hashedPassword = await hashPassword(password);
        await User.updateOne({ _id: foundToken.user }, { password: hashedPassword, isVerified: true });
        res.status(200).send(json({
            error: false,
            message: "Succesfully updated the password! Redirecting to login...",
        }));
    }
    catch (err) {
        throw err;
    }
};
usersRouter.get("/users", protectRoute(["ADVANCED"]), handleGetUsers);
usersRouter.post("/users", protectRoute(["ADVANCED"]), sanitizePostUserPayload, handleCreateUser);
usersRouter.patch("/users/:id", protectRoute(["ADVANCED"]), sanitizePatchUserPayload, handlePatchUser);
usersRouter.delete("/users/:id", protectRoute(["ADVANCED"]), handleDeleteUser);
usersRouter.post("/users/register/:token_id", completeRegistration);
export default usersRouter;
