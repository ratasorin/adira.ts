import type { IProduct } from "../models/Product";
import { type Json, json } from "../types/json";
import { protectInputKeys } from "../middleware/input";
import express, { Request, Response, Router } from "express";
import { protectRoute } from "../middleware/auth";
import { buildDeleteHandler, buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import Product, { BaseProduct, ProductDetails } from "../models/Product";
import { ErrorResponse } from "../types";
import { Types } from "mongoose";
import { Backend } from "@n/adira.core.ts";
import { ApiError } from "../utils/api-errors";
import { asyncHandler } from "../middleware/async-handler";
const productsRouter = Router();
const getExecutor = buildGetHandler(Product);
const postExecutor = buildPostHandler(Product), sanitizePostProductPayload = protectInputKeys([
    "_id",
    "createdAt",
    "deletedAt",
    "hidden",
    "primary",
    "base_product",
]);
const patchExecutor = buildPatchHandler(Product), sanitizePatchProductPayload = protectInputKeys([
    "_id",
    "createdAt",
    "deletedAt",
    "hidden",
    "primary",
    "base_product",
]);
const patchMetadataExecutor = buildPatchHandler(Product), sanitizePatchProductMetadataPayload = protectInputKeys(["_id", "deletedAt", "details", "base_product", "name", "createdAt"]);
const deleteExecutor = buildDeleteHandler(Product);
export type ProductsGetExecutor = typeof getExecutor;
export const handleGetProducts = async (req: Request<never, never, never, Backend.InferHandlerParams<ProductsGetExecutor>>, res: Response<Json<Backend.InferHandlerResponse<ProductsGetExecutor> | ErrorResponse>>) => {
    try {
        const rows = await getExecutor(req.query);
        res.send(json(rows));
    }
    catch (error) {
        throw error;
    }
};
export type ProductsPostExecutor = typeof postExecutor;
export const handlePostProduct = async (req: Request<never, never, Json<Pick<IProduct, "name" | "details"> & { base_owner_company: string; tags?: string[] }>, Backend.InferHandlerParams<ProductsPostExecutor>>, res: Response<Json<Backend.InferHandlerResponse<ProductsPostExecutor> | ErrorResponse>>) => {
    try {
        const newBaseProduct = await BaseProduct.create({
            base_owner_company: new Types.ObjectId(req.body.base_owner_company),
        });
        const row = await postExecutor(req.query, Product.castObject({
            ...req.body,
            _id: new Types.ObjectId().toString(),
            base_product: newBaseProduct._id.toString(),
            primary: true,
            createdAt: new Date(),
            deletedAt: null,
            hidden: false,
        }));
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type ProductsPatchExecutor = typeof patchExecutor;
export const handlePatchProduct = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<ProductsPatchExecutor>>, {}>, res: Response<Json<Backend.InferHandlerResponse<ProductsPatchExecutor> | ErrorResponse>>) => {
    try {
        const source = await Product.findById(req.params.id).lean();
        if (!source)
            throw new ApiError(404, "Record not found");
        const row = await postExecutor(req.query, Product.castObject({ ...source, ...req.body, _id: new Types.ObjectId().toString(), primary: false, createdAt: new Date() }));
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export type ProductMetadataPatchExecutor = typeof patchMetadataExecutor;
export const handlePatchProductMetadata = async (req: Request<{
    id: string;
}, never, Json<Backend.InferRequestBody<ProductMetadataPatchExecutor>>, Backend.InferHandlerParams<ProductMetadataPatchExecutor>>, res: Response<Json<Backend.InferHandlerResponse<ProductMetadataPatchExecutor> | ErrorResponse>>) => {
    try {
        const row = await patchMetadataExecutor(req.params.id, req.query, Product.castObject(req.body), {
            createNewRecord: false,
        });
        res.send(json(row));
    }
    catch (error) {
        throw error;
    }
};
export const handlePostProductVersion = async (req: Request<{
    id: string;
}, never, Json<{
    name: string;
    details: ProductDetails;
}>, Backend.InferHandlerParams<ProductsPostExecutor>>, res: Response<Json<Backend.InferHandlerResponse<ProductsPostExecutor> | ErrorResponse>>) => {
    try {
        const source = await Product.findById(req.params.id).lean();
        if (!source) {
            throw new ApiError(404, `Record ${req.params.id} not found`);
        }
        const created = await Product.create({
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
export const handleDeleteProduct = async (req: Request<{
    id: string;
}, never, {}, {}>, res: Response<Json<ErrorResponse | {
    error: false;
}>>) => {
    try {
        await deleteExecutor(req.params.id, {}, {
            softDelete: async () => {
                await Product.findByIdAndUpdate(new Types.ObjectId(req.params.id), {
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
productsRouter.get("/products", protectRoute(), handleGetProducts);
productsRouter.post("/products", protectRoute(), sanitizePostProductPayload, handlePostProduct);
productsRouter.post("/products/:id/version", protectRoute(), handlePostProductVersion);
productsRouter.patch("/products/:id", protectRoute(), sanitizePatchProductPayload, handlePatchProduct);
productsRouter.patch("/products/:id/metadata", protectRoute(), sanitizePatchProductMetadataPayload, handlePatchProductMetadata);
productsRouter.delete("/products/:id", protectRoute(), handleDeleteProduct);
export default productsRouter;
