import { nextInvoiceNumber } from "../invoice/utils/next-invoice-number";
import { type Json, json } from "../../types/json";
import { protectInputKeys } from "../../middleware/input";
import { Request, Response } from "express";
import { ApiError } from "../../utils/api-errors";
import { ErrorResponse } from "../../types";
import { BaseInvoice } from "../../models/invoice/Invoice";
import { Backend } from "@n/adira.core.ts";
import { buildGetHandler, buildPostHandler } from "@n/adira.backend.ts";
import mongoose from "mongoose";
import { Counter } from "../../models/Counter";
const baseInvoiceGet = buildGetHandler(BaseInvoice);
export const baseInvoicePost = buildPostHandler(BaseInvoice), sanitizePostBaseInvoicePayload = protectInputKeys(["latest_version", "_id"]);
type GetBaseInvoices = typeof baseInvoiceGet;
export const handleGetBaseInvoice = async (req: Request<never, never, never, Backend.InferHandlerParams<GetBaseInvoices>>, res: Response<Json<Backend.InferHandlerResponse<GetBaseInvoices> | ErrorResponse>>) => {
    try {
        const baseInvoices = await baseInvoiceGet(req.query);
        res.status(200).json(json(baseInvoices));
    }
    catch (error) {
        throw error;
    }
};
type PostBaseInvoice = typeof baseInvoicePost;
export const handlePostBaseInvoice = async (req: Request<never, never, Json<Backend.InferRequestBody<PostBaseInvoice>>, Backend.InferHandlerParams<PostBaseInvoice>>, res: Response<Json<Backend.InferHandlerResponse<PostBaseInvoice> | ErrorResponse>>) => {
    try {
        const baseInvoice = await baseInvoicePost(req.query, {
            ...req.body,
            _id: new mongoose.Types.ObjectId().toString(),
            latest_version: 1,
        });
        res.status(200).json(json(baseInvoice));
    }
    catch (error) {
        throw error;
    }
};
export const handleAllocateBaseInvoice = async (req: Request<{
    base_company_id?: string;
}, never, never, {
    index?: number;
    allocationScope?: "local" | "global";
}>, res: Response<Json<{
    _id: string;
    index: number;
    latest_version: number;
} | ErrorResponse>>) => {
    const { base_company_id } = req.params;
    if (!base_company_id)
        throw new ApiError(400, "The base company scope was not provided!");
    try {
        const counter = await Counter.findOne({ scope: base_company_id })
            .select({ value: 1 })
            .lean();
        if (!counter) {
            throw new ApiError(404, "No counter found for the provided base company!");
        }
        const requestedIndex = Number(req.query.index);

        const hasRequestedIndex = req.query.index !== undefined &&
            Number.isSafeInteger(requestedIndex) &&
            requestedIndex > 0;
        if (req.query.index !== undefined && !hasRequestedIndex) throw new ApiError(400, "Invoice number must be a positive integer");
        const allocationScope = req.query.allocationScope === "local" ? "local" : "global";
        const targetIndex = hasRequestedIndex ? requestedIndex : await nextInvoiceNumber(counter.value);
        if (allocationScope === "global" && targetIndex < counter.value) {
            throw new ApiError(400, "Global invoice allocation requires an index greater than the current counter value");
        }
        const existingBaseInvoice = await BaseInvoice.findOne({
            index: targetIndex,
        })
            .select({ _id: 1 })
            .lean();
        if (existingBaseInvoice) {
            throw new ApiError(409, "The requested invoice number is already in use");
        }
        if (allocationScope === "global") {
            await Counter.updateOne({ scope: base_company_id }, {
                $max: {
                    value: targetIndex,
                },
            });
        }
        const created = await BaseInvoice.create({
            _id: new mongoose.Types.ObjectId().toString(),
            index: targetIndex,
            latest_version: 1,
        });
        res.status(200).json(json({
            _id: String(created._id),
            index: created.index,
            latest_version: created.latest_version,
        }));
    }
    catch (error) {
        throw error;
    }
};
