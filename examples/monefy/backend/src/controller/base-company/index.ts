import { type Json, json } from "../../types/json";
import { protectInputKeys } from "../../middleware/input";
import { Request, Response } from "express";
import { Backend } from "@n/adira.core.ts";
import { buildGetHandler, buildPatchHandler } from "@n/adira.backend.ts";
import { ErrorResponse } from "../../types";
import { ApiError } from "../../utils/api-errors";
import Company, { BaseCompany } from "../../models/Company";
const baseCompanyGet = buildGetHandler(BaseCompany);
export const baseCompanyPatch = buildPatchHandler(BaseCompany), sanitizePatchBaseCompanyPayload = protectInputKeys(["_id"]);
type GetBaseCompanies = typeof baseCompanyGet;
export const handleGetBaseCompany = async (req: Request<{ id: string }, never, never, Backend.InferHandlerParams<GetBaseCompanies>>, res: Response<Json<Backend.InferHandlerResponse<GetBaseCompanies> | ErrorResponse>>) => {
    try {
        const baseCompanies = await baseCompanyGet({ ...req.query, where: { _id: { $eq: req.params.id } } });
        res.status(200).json(json(baseCompanies));
    }
    catch (error) {
        throw error;
    }
};
type PatchBaseCompany = typeof baseCompanyPatch;
export const handlePatchBaseCompany = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<PatchBaseCompany>>, Backend.InferHandlerParams<PatchBaseCompany>>, res: Response<Json<Backend.InferHandlerResponse<PatchBaseCompany> | ErrorResponse>>) => {
    try {
        const id = req.params.id;
        if (!id) {
            throw new ApiError(400, "Missing id for base company!");
        }
        const baseCompany = await baseCompanyPatch(id, req.query, req.body, { createNewRecord: false });
        res.status(200).json(json(baseCompany));
    }
    catch (error) {
        throw error;
    }
};
