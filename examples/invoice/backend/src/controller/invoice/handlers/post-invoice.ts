import type { InvoiceInput } from "../types";
import { type Json, json } from "../../../types/json";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { Types } from "mongoose";
import Invoice, { BaseInvoice } from "../../../models/invoice/Invoice";
import { ErrorResponse } from "../../../types";
import { ApiError } from "../../../utils/api-errors";
import { postInvoice, PostInvoiceFn } from "../base";
import { resolveInvoiceData } from "../resolve-invoice-data";
import { calculateInvoiceState } from "../utils/total";
export const handlePostInvoice = async (req: Request<never, never, InvoiceInput, Backend.InferHandlerParams<PostInvoiceFn>>, res: Response<Json<Backend.InferHandlerResponse<PostInvoiceFn> | ErrorResponse>>) => {
    const baseInvoice = await BaseInvoice.findById(req.body.base_invoice).lean();
    if (!baseInvoice) {
        throw new ApiError(404, "Base invoice not found");
    }
    const { productLines, modifierLines, viewerLines } = await resolveInvoiceData({
        modifierLines: req.body.modifiers,
        productLines: req.body.products,
        viewerLines: req.body.viewers,
    });
    const { total, currency, viewers } = await calculateInvoiceState(productLines, modifierLines, viewerLines);
    try {
        if (!req.body.language) {
            throw new ApiError(400, "Invoice language is required");
        }
        const newest = await Invoice.findOne({
            base_invoice: baseInvoice._id,
            deletedAt: null,
        })
            .sort({ version: -1 })
            .select({ version: 1 })
            .lean();
        const nextVersion = (newest?.version ?? 0) + 1;
        const invoice = await postInvoice(req.query, Invoice.castObject({
            ...req.body,
            _id: new Types.ObjectId().toString(),
            total,
            currency,
            viewers,
            reporter: req.user!.id,
            version: nextVersion,
            base_invoice: baseInvoice._id,
            language: req.body.language,
        }));
        await BaseInvoice.updateOne({ _id: baseInvoice._id }, { $max: { latest_version: nextVersion } }, { runValidators: true });
        res.status(200).json(json(invoice));
    }
    catch (error) {
        throw error;
    }
};
