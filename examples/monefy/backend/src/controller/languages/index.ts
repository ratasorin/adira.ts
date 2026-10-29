import type { IInvoiceTemplateTranslation } from "../../models/invoice/TemplateTranslations";
import { type Json, json } from "../../types/json";
import { protectInputKeys } from "../../middleware/input";
import { buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import InvoiceTemplateTranslation from "../../models/invoice/TemplateTranslations";
import Languages from "../../models/Languages";
import { ErrorResponse } from "../../types";
import { Request, Response } from "express";
import { Backend, PopulateSchema } from "@n/adira.core.ts";
import mongoose from "mongoose";
import { IInvoice } from "../../models/invoice/Invoice";
import { ApiError } from "../../utils/api-errors";
export const getTemplateTranslations = buildGetHandler(InvoiceTemplateTranslation);
export const createTemplateTranslations = buildPostHandler(InvoiceTemplateTranslation), sanitizePostTemplateTranslationPayload = protectInputKeys(["_id"]);
export const patchTemplateTranslation = buildPatchHandler(InvoiceTemplateTranslation), sanitizePatchTemplateTranslationPayload = protectInputKeys(["_id"]);
type F = Json<PopulateSchema<IInvoice>>;
type FF = PopulateSchema<IInvoice>;
export type GetTemplateTranslationsFn = typeof getTemplateTranslations;
export type PatchTemplateTranslationsFn = typeof patchTemplateTranslation;
export type PostTemplateTranslationsFn = typeof createTemplateTranslations;
export const handleGetTemplateTranslation = async (req: Request<never, never, never, Backend.InferHandlerParams<GetTemplateTranslationsFn>>, res: Response<Json<Backend.InferHandlerResponse<GetTemplateTranslationsFn> | ErrorResponse>>) => {
    try {
        const translations = await getTemplateTranslations(req.query);
        res.status(200).send(json(translations));
    }
    catch (error) {
        throw error;
    }
};
export const handlePatchTemplateTranslation = async (req: Request<{
    id?: string;
}, never, Json<Backend.InferRequestBody<PatchTemplateTranslationsFn>>, Backend.InferHandlerParams<PatchTemplateTranslationsFn>>, res: Response<Json<Backend.InferHandlerResponse<PatchTemplateTranslationsFn> | ErrorResponse>>) => {
    try {
        if (!req.params.id) {
            throw new Error("Cannot update a record with no id!");
        }
        const translation = await patchTemplateTranslation(req.params.id, req.query, InvoiceTemplateTranslation.castObject(req.body), { createNewRecord: false });
        res.status(200).send(json(translation));
    }
    catch (error) {
        throw error;
    }
};
export const handlePostTemplateTranslation = async (req: Request<never, never, Json<{
    language_code: string;
    language_name: string;
    opening: string;
    invoice: string;
    table_headers: {
        description: string;
        quantity: string;
        unit_price: string;
        subtotal: string;
        total: string;
    };
    affects: string;
    reported_period: string;
    bank_name: string;
    account_beneficiary: string;
    account_number: string;
    bank_code: string;
    thanks: string;
}>, Backend.InferHandlerParams<PostTemplateTranslationsFn>>, res: Response<Json<Pick<IInvoiceTemplateTranslation, "_id" | "language"> | ErrorResponse>>) => {
    try {
        const payload = req.body;
        const languageCode = String(payload.language_code || "")
            .trim()
            .toLowerCase();
        const languageName = String(payload.language_name || "").trim();
        if (!languageCode || !languageName) {
            throw new ApiError(400, "language_code and language_name are required");
        }
        let language = await Languages.findOne({ code: languageCode });
        if (!language) {
            language = await Languages.create({
                _id: new mongoose.Types.ObjectId().toString(),
                code: languageCode,
                name: languageName,
            });
        }
        else if (language.name !== languageName) {
            language.name = languageName;
            await language.save();
        }
        const existingTranslation = await InvoiceTemplateTranslation.findOne({
            language: language._id,
        }).lean();
        if (existingTranslation) {
            throw new ApiError(409, `A template translation already exists for ${languageCode}`);
        }
        const translation = await InvoiceTemplateTranslation.create({
            _id: new mongoose.Types.ObjectId().toString(),
            language: language._id,
            opening: payload.opening,
            invoice: payload.invoice,
            table_headers: payload.table_headers,
            affects: payload.affects,
            reported_period: payload.reported_period,
            bank_name: payload.bank_name,
            account_beneficiary: payload.account_beneficiary,
            account_number: payload.account_number,
            bank_code: payload.bank_code,
            thanks: payload.thanks,
        });
        res.status(200).json(json(translation));
    }
    catch (error) {
        throw error;
    }
};
