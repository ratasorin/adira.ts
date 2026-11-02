import type { InvoiceInput } from "../types";
import { type Json, json } from "../../../types/json";
import { Types } from "mongoose";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import InvoiceChangeLog, { IInvoiceChangeLog, } from "../../../models/invoice/ChangeLog";
import Invoice, { BaseInvoice } from "../../../models/invoice/Invoice";
import { ErrorResponse } from "../../../types";
import { ApiError } from "../../../utils/api-errors";
import { patchInvoice, postInvoice, PatchInvoiceFn } from "../base";
import { resolveInvoiceData } from "../resolve-invoice-data";
import { buildInvoiceChanges } from "../utils/build-invoice-changes";
import { calculateInvoiceState } from "../utils/total";
export const handlePatchInvoice = async (req: Request<{
    id: string;
}, never, Partial<Omit<InvoiceInput, "base_invoice">>, Backend.InferHandlerParams<PatchInvoiceFn>>, res: Response<Json<Backend.InferHandlerResponse<PatchInvoiceFn, IInvoiceChangeLog | null> | ErrorResponse>>) => {
    try {
        if (!req.params.id) {
            throw new Error("Cannot update a record with no id!");
        }
        if (!req.user?.id) {
            throw new Error("Cannot update this record without being authenticated!");
        }
        const oldInvoice = await Invoice.findById(req.params.id).lean();
        if (!oldInvoice) {
            throw new ApiError(404, "Invoice not found");
        }
        const baseInvoiceId = oldInvoice.base_invoice;
        const baseInvoice = await BaseInvoice.findById(baseInvoiceId).lean();
        if (!baseInvoice) {
            throw new ApiError(404, "Base invoice not found");
        }
        const newest = await Invoice.findOne({
            base_invoice: baseInvoiceId,
            deletedAt: null,
        })
            .sort({ version: -1 })
            .select({ version: 1 })
            .lean();
        const nextVersion = (newest?.version ?? oldInvoice.version ?? 0) + 1;
        const { productLines, modifierLines, viewerLines } = await resolveInvoiceData({
            modifierLines: req.body.modifiers || json(oldInvoice.modifiers),
            productLines: req.body.products || json(oldInvoice.products),
            viewerLines: req.body.viewers || json(oldInvoice.viewers),
        });
        const { total, currency, viewers } = await calculateInvoiceState(productLines, modifierLines, viewerLines);
        const normalizedViewers = viewers.map((viewer) => ({
            _id: viewer._id,
            viewer: viewer.viewer,
            index: viewer.index,
            subtotal: viewer.subtotal,
            currency: viewer.currency,
        }));
        const nextLanguage = req.body.language || oldInvoice.language?.toString();
        if (!nextLanguage) {
            throw new ApiError(400, "Invoice language is required");
        }
        const nextInvoice = { ...Invoice.castObject({
            ...oldInvoice,
            ...req.body,
            products: req.body.products || oldInvoice.products,
            modifiers: req.body.modifiers || oldInvoice.modifiers,
            viewers: normalizedViewers,
            total,
            currency,
            language: nextLanguage,
            from_invoice: String(oldInvoice._id),
            version: nextVersion,
        }), __v: oldInvoice.__v };
        const pendingChanges = await buildInvoiceChanges(oldInvoice, nextInvoice);
        if (!pendingChanges.length) {
            throw new ApiError(400, "Cannot update invoice! Nothing changed!");
        }
        const invoice = await postInvoice(req.query, Invoice.castObject({
            ...oldInvoice,
            _id: new Types.ObjectId().toString(),
            ...req.body,
            reporter: req.user.id,
            total,
            currency,
            language: nextLanguage,
            from_invoice: String(oldInvoice._id),
            version: nextVersion,
            viewers,
        }));
        const newInvoice = await Invoice.findById(invoice._id).lean();
        if (!newInvoice) {
            throw new ApiError(400, `Comparison failed. Old: ${!!oldInvoice}, New: ${!!newInvoice}`);
        }
        const changes = await buildInvoiceChanges(oldInvoice, newInvoice);
        let finalVersion = newInvoice.version;
        await BaseInvoice.updateOne({ _id: baseInvoiceId }, { $max: { latest_version: finalVersion } }, { runValidators: true });
        let change: IInvoiceChangeLog | null = null;
        change = await InvoiceChangeLog.create({
            base_invoice: newInvoice.base_invoice,
            version: finalVersion,
            changes,
            changed_by: req.user.id,
            changed_at: new Date(),
        });
        res.status(200).send(json({ ...invoice, related: change }));
    }
    catch (error) {
        throw error;
    }
};
