import type { ICustomer } from "../models/Customer";
import { type Json, json } from "../types/json";
import { protectInputKeys } from "../middleware/input";
import express, { Request, Response, Router } from "express";
import { protectRoute } from "../middleware/auth";
import { buildDeleteHandler, buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import Customer, { BaseCustomer, CustomerDetails } from "../models/Customer";
import { ErrorResponse } from "../types";
import { Types } from "mongoose";
import { Backend } from "@n/adira.core.ts";
import { ApiError } from "../utils/api-errors";
import { asyncHandler } from "../middleware/async-handler";
const customerRouter = Router();
const getExecutor = buildGetHandler(Customer);
const postExecutor = buildPostHandler(Customer), sanitizePostCustomerPayload = protectInputKeys(["_id", "primary", "deletedAt", "createdAt"]);
const patchExecutor = buildPatchHandler(Customer), sanitizePatchCustomerPayload = protectInputKeys(["_id", "primary", "deletedAt", "createdAt"]);
const patchMetadataExecutor = buildPatchHandler(Customer), sanitizePatchCustomerMetadataPayload = protectInputKeys(["_id", "deletedAt", "details", "base_customer", "createdAt"]);
const deleteExecutor = buildDeleteHandler(Customer);
export type CustomerGetExecutor = typeof getExecutor;
export const handleGetCustomers = async (req: Request<never, never, never, Backend.InferHandlerParams<CustomerGetExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CustomerGetExecutor> | ErrorResponse>>) => {
    try {
        const rows = await getExecutor(req.query);
        res.send(json(rows));
    }
    catch (error) {
        throw error;
    }
};
export type CustomerPostExecutor = typeof postExecutor;
export const handlePostCustomer = async (req: Request<never, never, Json<Pick<ICustomer, "details"> & { base_customer?: string; tags?: string[] }>, Backend.InferHandlerParams<CustomerPostExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CustomerPostExecutor> | ErrorResponse>>) => {
    try {
        const base = req.body.base_customer || (await BaseCustomer.create({ internal_name: req.body.details.selected_name }))._id;
        const row = await postExecutor(req.query, Customer.castObject({
            ...req.body,
            base_customer: base,
            _id: new Types.ObjectId().toString(),
            primary: true,
            deletedAt: null,
            createdAt: new Date(),
        }));
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type CustomerPatchExecutor = typeof patchExecutor;
export const handlePatchCustomer = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<CustomerPatchExecutor>>, {}>, res: Response<Json<Backend.InferHandlerResponse<CustomerPatchExecutor> | ErrorResponse>>) => {
    try {
        const source = await Customer.findById(req.params.id).lean();
        if (!source)
            throw new ApiError(404, "Record not found");
        const row = await postExecutor(req.query, Customer.castObject({ ...source, ...req.body, _id: new Types.ObjectId().toString(), primary: false, createdAt: new Date() }));
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type CustomerMetadataPatchExecutor = typeof patchMetadataExecutor;
export const handlePatchCustomerMetadata = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<CustomerMetadataPatchExecutor>>, Backend.InferHandlerParams<CustomerMetadataPatchExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CustomerMetadataPatchExecutor> | ErrorResponse>>) => {
    try {
        const row = await patchMetadataExecutor(req.params.id, req.query, Customer.castObject(req.body), {
            createNewRecord: false,
        });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export const handlePostCustomerVersion = async (req: Request<{
    id: string;
}, never, Json<{
    details: CustomerDetails;
}>, Backend.InferHandlerParams<CustomerPostExecutor>>, res: Response<Json<Backend.InferHandlerResponse<CustomerPostExecutor> | ErrorResponse>>) => {
    try {
        const source = await Customer.findById(req.params.id).lean();
        if (!source) {
            throw new ApiError(404, `Record ${req.params.id} not found`);
        }
        const created = await Customer.create({
            ...source,
            _id: new Types.ObjectId().toString(),
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
export const handleDeleteCustomer = async (req: Request<{
    id: string;
}, never, {}, {}>, res: Response<Json<ErrorResponse | {
    error: false;
}>>) => {
    try {
        await deleteExecutor(req.params.id, {}, {
            softDelete: async () => {
                await Customer.findByIdAndUpdate(new Types.ObjectId(req.params.id), {
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
customerRouter.get("/customers", protectRoute(), handleGetCustomers);
customerRouter.post("/customers", protectRoute(), sanitizePostCustomerPayload, handlePostCustomer);
customerRouter.post("/customers/:id/version", protectRoute(), handlePostCustomerVersion);
customerRouter.patch("/customers/:id", protectRoute(), sanitizePatchCustomerPayload, handlePatchCustomer);
customerRouter.patch("/customers/:id/metadata", protectRoute(), sanitizePatchCustomerMetadataPayload, handlePatchCustomerMetadata);
customerRouter.delete("/customers/:id", protectRoute(), handleDeleteCustomer);
export default customerRouter;
