import { Counter } from "../models/Counter";
import type { ICompany } from "../models/Company";
import { type Json, json } from "../types/json";
import { protectInputKeys } from "../middleware/input";
import { Request, Response, Router } from "express";
import { protectRoute } from "../middleware/auth";
import { buildDeleteHandler, buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import { Backend } from "@n/adira.core.ts";
import Company, { BaseCompany, CompanyDetails } from "../models/Company";
import { ErrorResponse } from "../types";
import { Types } from "mongoose";
import { ApiError } from "../utils/api-errors";
import { asyncHandler } from "../middleware/async-handler";
const companyRouter = Router();
const getExecutor = buildGetHandler(Company);
const postExecutor = buildPostHandler(Company), sanitizePostCompanyPayload = protectInputKeys([
    "primary",
    "hidden",
    "deletedAt",
    "base_company",
    "_id",
]);
const patchExecutor = buildPatchHandler(Company), sanitizePatchCompanyPayload = protectInputKeys([
    "primary",
    "hidden",
    "deletedAt",
    "base_company",
    "_id",
]);
const patchMetadataExecutor = buildPatchHandler(Company), sanitizePatchCompanyMetadataPayload = protectInputKeys(["_id", "deletedAt", "details", "base_company", "name"]);
const deleteExecutor = buildDeleteHandler(Company);
export type CompaniesGetExecutor = typeof getExecutor;
export const handleGetCompanies = async (req: Request<never, never, never, Backend.InferHandlerParams<CompaniesGetExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CompaniesGetExecutor> | ErrorResponse>>) => {
    try {
        const rows = await getExecutor(req.query);
        res.send(json(rows));
    }
    catch (error) {
        throw error;
    }
};
export type CompanyPostExecutor = typeof postExecutor;
export const handlePostCompanies = async (req: Request<never, never, Json<Pick<ICompany, "name" | "details"> & { tags?: string[] }>, {}>, res: Response<Json<Backend.InferHandlerResponse<CompanyPostExecutor> | ErrorResponse>>) => {
    try {
        const newBaseCompany = await BaseCompany.create({});
        await Counter.create({ scope: String(newBaseCompany._id), value: 0 });
        const row = await postExecutor(req.query, Company.castObject({
            ...req.body,
            _id: new Types.ObjectId().toString(),
            primary: true,
            hidden: false,
            deletedAt: null,
            base_company: newBaseCompany._id.toString(),
        }));
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type CompaniesPatchExecutor = typeof patchExecutor;
export const handlePatchCompany = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<CompaniesPatchExecutor>>, Backend.InferHandlerParams<CompaniesPatchExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CompaniesPatchExecutor> | ErrorResponse>>) => {
    try {
        const source = await Company.findById(req.params.id).lean();
        if (!source)
            throw new ApiError(404, "Record not found");
        const row = await postExecutor(req.query, Company.castObject({ ...source, ...req.body, _id: new Types.ObjectId().toString(), primary: false, createdAt: new Date() }));
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type CompanyMetadataPatchExecutor = typeof patchMetadataExecutor;
export const handlePatchCompanyMetadata = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<CompanyMetadataPatchExecutor>>, Backend.InferHandlerParams<CompanyMetadataPatchExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CompanyMetadataPatchExecutor> | ErrorResponse>>) => {
    try {
        const row = await patchMetadataExecutor(req.params.id, req.query, Company.castObject(req.body), {
            createNewRecord: false,
        });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export const handlePostCompanyVersion = async (req: Request<{
    id: string;
}, never, Json<{
    name: string;
    details: CompanyDetails;
}>, Backend.InferHandlerParams<CompanyPostExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CompanyPostExecutor> | ErrorResponse>>) => {
    try {
        const source = await Company.findById(req.params.id).lean();
        if (!source) {
            throw new ApiError(404, `Record ${req.params.id} not found`);
        }
        const created = await Company.create({
            ...source,
            _id: new Types.ObjectId().toString(),
            name: req.body.name,
            details: req.body.details,
            primary: false,
            createdAt: new Date(),
        });
        const rows = await getExecutor({
            ...req.query,
            where: { _id: { $eq: created._id.toString() } },
        });
        res.send(json(rows.rows[0]));
    }
    catch (error) {
        throw error;
    }
};
export const handleDeleteCompany = async (req: Request<{
    id: string;
}, never, {}, {}>, res: Response<Json<ErrorResponse | {
    error: false;
}>>) => {
    try {
        await deleteExecutor(req.params.id, {}, {
            softDelete: async () => {
                await Company.findByIdAndUpdate(new Types.ObjectId(req.params.id), {
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
companyRouter.get("/companies", protectRoute(), handleGetCompanies);
companyRouter.post("/companies", protectRoute(), sanitizePostCompanyPayload, handlePostCompanies);
companyRouter.post("/companies/:id/version", protectRoute(), handlePostCompanyVersion);
companyRouter.patch("/companies/:id", protectRoute(), sanitizePatchCompanyPayload, handlePatchCompany);
companyRouter.patch("/companies/:id/metadata", protectRoute(), sanitizePatchCompanyMetadataPayload, handlePatchCompanyMetadata);
companyRouter.delete("/companies/:id", protectRoute(), handleDeleteCompany);
export default companyRouter;
