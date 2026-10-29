import { ApiError } from "../../utils/api-errors";
import { type Json, json } from "../../types/json";
import { protectInputKeys } from "../../middleware/input";
import { Request, Response } from "express";
import { buildDeleteHandler, buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import Modifier from "../../models/Modifier";
import { ErrorResponse } from "../../types";
import { Backend } from "@n/adira.core.ts";
import mongoose from "mongoose";
export const getModifiers = buildGetHandler(Modifier);
export const postModifier = buildPostHandler(Modifier), sanitizePostModifierPayload = protectInputKeys(["_id"]);
export const patchModifier = buildPatchHandler(Modifier), sanitizePatchModifierPayload = protectInputKeys(["_id"]);
export const deleteModifier = buildDeleteHandler(Modifier);
export type GetModifiersExecutor = typeof getModifiers;
export const handleGetModifiers = async (req: Request<never, never, never, Backend.InferHandlerParams<GetModifiersExecutor>>, res: Response<Json<Backend.InferHandlerResponse<GetModifiersExecutor> | ErrorResponse>>) => {
    try {
        const rows = await getModifiers(req.query);
        res.send(json(rows));
    }
    catch (error) {
        throw error;
    }
};
export type PostModifierExecutor = typeof postModifier;
export const handlePostModifier = async (req: Request<never, never, Json<Backend.InferRequestBody<PostModifierExecutor>>, Backend.InferHandlerParams<PostModifierExecutor>>, res: Response<Json<Backend.InferHandlerResponse<PostModifierExecutor> | ErrorResponse>>) => {
    try {
        const row = await postModifier(req.query, { ...req.body, _id: new mongoose.Types.ObjectId().toString() });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type PatchModifierExecutor = typeof patchModifier;
export const handlePatchModifier = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<PatchModifierExecutor>>, {}>, res: Response<Json<Backend.InferHandlerResponse<PatchModifierExecutor> | ErrorResponse>>) => {
    try {
        const source = await Modifier.findById(req.params.id).lean();
        if (!source) throw new ApiError(404, "Record not found");
        const row = await postModifier(req.query, { ...source, ...req.body, _id: new mongoose.Types.ObjectId().toString() });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
