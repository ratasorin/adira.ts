import { ApiError } from "../../utils/api-errors";
import { type Json, json } from "../../types/json";
import { protectInputKeys } from "../../middleware/input";
import { Request, Response } from "express";
import { buildDeleteHandler, buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import Viewer from "../../models/Viewer";
import { ErrorResponse } from "../../types";
import { Backend } from "@n/adira.core.ts";
import mongoose from "mongoose";
export const getViewers = buildGetHandler(Viewer);
export const postViewer = buildPostHandler(Viewer), sanitizePostViewerPayload = protectInputKeys(["_id"]);
export const patchViewer = buildPatchHandler(Viewer), sanitizePatchViewerPayload = protectInputKeys(["_id"]);
export const deleteViewer = buildDeleteHandler(Viewer);
export type GetViewersExecutor = typeof getViewers;
export const handleGetViewers = async (req: Request<never, never, never, Backend.InferHandlerParams<GetViewersExecutor>>, res: Response<Json<Backend.InferHandlerResponse<GetViewersExecutor> | ErrorResponse>>) => {
    try {
        const rows = await getViewers(req.query);
        res.send(json(rows));
    }
    catch (error) {
        throw error;
    }
};
export type PostViewerExecutor = typeof postViewer;
export const handlePostViewer = async (req: Request<never, never, Json<Backend.InferRequestBody<PostViewerExecutor>>, Backend.InferHandlerParams<PostViewerExecutor>>, res: Response<Json<Backend.InferHandlerResponse<PostViewerExecutor> | ErrorResponse>>) => {
    try {
        const row = await postViewer(req.query, { ...req.body, _id: new mongoose.Types.ObjectId().toString() });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type PatchViewerExecutor = typeof patchViewer;
export const handlePatchViewer = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<PatchViewerExecutor>>, Backend.InferHandlerParams<PatchViewerExecutor>>, res: Response<Json<Backend.InferHandlerResponse<PatchViewerExecutor> | ErrorResponse>>) => {
    try {
        const source = await Viewer.findById(req.params.id).lean();
        if (!source) throw new ApiError(404, "Record not found");
        const row = await postViewer(req.query, { ...source, ...req.body, _id: new mongoose.Types.ObjectId().toString() });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export const handleDeleteViewer = async (req: Request<{
    id: string;
}, never, {}, {}>, res: Response<Json<ErrorResponse | {
    error: false;
}>>) => {
    try {
        await deleteViewer(req.params.id, {}, {});
        res.send(json({ error: false }));
    }
    catch (error) {
        throw error;
    }
};
