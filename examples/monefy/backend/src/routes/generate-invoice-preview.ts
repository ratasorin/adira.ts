import { type Json, json } from "../types/json";
import type { PreviewJobResponse } from "../pdf/contracts";
import type { ResolvedInvoice } from "../controller/invoice/types";
import { submitJob } from "../pdf/jobs";
import { previewDraftSchema } from "../pdf/validation";
import { Router, Request, Response } from "express";
import { DEFAULT_ENGLISH_TEMPLATE, } from "../controller/invoice/generate-pdf";
import { ErrorResponse } from "../types";
import { protectRoute } from "../middleware/auth";
import { IModifierLineValue, InvoiceDraft, IProductLineValue, IViewerLineValue, } from "../controller/invoice/types";
import { calculateInvoiceState, normalizeProductLinesCurrency } from "../controller/invoice/utils/total";
import { Backend, PopulateSchema, Scalar, SchemaAfterJoin } from "@n/adira.core.ts";
import { getInvoices } from "../controller/invoice";
import { IInvoice } from "../models/invoice/Invoice";
import Languages from "../models/Languages";
import InvoiceTemplateTranslation from "../models/invoice/TemplateTranslations";
import Company, { BaseCompany } from "../models/Company";
import { buildModifierViewerTranslationKey, resolveModifierViewerNames, } from "../controller/invoice/resolve-modifier-viewer-names";
import { ApiError } from "../utils/api-errors";
import { asyncHandler } from "../middleware/async-handler";
const generateRouter = Router();
export const handleGeneratePreview = async (req: Request<never, never, Json<InvoiceDraft>, {}>, res: Response<Json<PreviewJobResponse | ErrorResponse>>) => {
    try {
        const params = previewDraftSchema.parse(req.body);
        const parsedProducts = params.products?.map((p) => ({
            _id: p._id,
            product: {
                ...p.product,
                price: Number(p.product.price),
            },
            quantity: Number(p.quantity),
        }) as IProductLineValue) || [];
        const parsedModifiers = params.modifiers?.map((m) => {
            const targets = "targetProductLine" in m ? m.targetProductLine : undefined;
            const currency = "currency" in m ? m.currency : undefined;
            return {
                index: Number(m.index),
                name: m.name,
                operation: m.operation,
                scope: m.scope as "line" | "total",
                type: m.type as "percentage" | "fixed",
                value: Number(m.value),
                targetProductLine: targets,
                currency,
            } as IModifierLineValue;
        }) || [];
        const parsedViewers = params.viewers?.map((m) => ({
            index: Number(m.index),
            name: m.name,
        }) as IViewerLineValue) || [];
        const { currency, total, viewers, modifiers } = await calculateInvoiceState(parsedProducts, parsedModifiers, parsedViewers);
        
        const language = await Languages.findById(params.language_id);
        let translation = DEFAULT_ENGLISH_TEMPLATE;
        if (language) {
            const partialTranslation = await InvoiceTemplateTranslation.findOne({
                language: language._id,
            }).lean();
            const company = await Company.findById(params.issuer_company?._id).lean();
            if (partialTranslation) {
                const baseCompany = company?.base_company
                    ? await BaseCompany.findById(company.base_company).lean()
                    : null;
                const closingRemark = baseCompany?.closing_remark.find((r) => r.language_code === language.code)?.text ||
                    DEFAULT_ENGLISH_TEMPLATE.closing_remark;
                translation = {
                    ...DEFAULT_ENGLISH_TEMPLATE,
                    ...partialTranslation,
                    closing_remark: closingRemark,
                };
            }
        }
        const resolvedNotes = params.notes || "";
        const payload: ResolvedInvoice = {
            invoiceNumber: Number(params.invoiceNumber || 0),
            issuer_company: params.issuer_company,
            translation,
            modifiers: modifiers,
            notes: resolvedNotes,
            products: await normalizeProductLinesCurrency(parsedProducts, currency),
            receiving_customer: params.receiving_customer,
            emittedDate: new Date(String(params.emittedDate || new Date().toISOString().slice(0, 10))),
            reportedPeriod: new Date(String(params.reportedPeriod || new Date().toISOString().slice(0, 7) + "-01")),
            viewers,
            currency,
            total,
        };
        const result = await submitJob(req.user!.id, req.body, payload);
        res.setHeader("X-Preview-Cache", result.cache);
        res.setHeader("Cache-Control", "no-store");
        res.status(result.status === "ready" ? 200 : 202).json(json(result));
    }
    catch (err) {
        throw err;
    }
};
const toProductLinesValue = (products: SchemaAfterJoin<IInvoice, "products.product">["products"]): IProductLineValue[] => {
    return products.map((p) => ({
        _id: p._id,
        product: {
            name: p.product!.name,
            currency: p.product!.details.currency,
            price: p.product!.details.unit_price,
        },
        quantity: p.quantity,
    }));
};
const toModifierLinesValue = async (modifiers: SchemaAfterJoin<IInvoice, "modifiers.modifier">["modifiers"], languageCode?: string) => {
    const resolvedNames = await resolveModifierViewerNames({
        languageCode,
        entries: modifiers.map((modifier) => ({
            entityType: "modifier" as const,
            entityId: String(modifier.modifier!._id),
            fallbackName: modifier.modifier!.name,
        })),
    });
    return modifiers.map((m) => ({
        ...m,
        name: resolvedNames.get(buildModifierViewerTranslationKey("modifier", String(m.modifier!._id)))?.text || m.modifier!.name,
        type: m.modifier!.type,
        value: m.modifier!.value,
        scope: m.modifier!.scope,
        operation: m.modifier!.operation,
        currency: m.modifier!.currency,
    })) as IModifierLineValue[];
};
const toViewerLinesValue = async (viewers: SchemaAfterJoin<IInvoice, "viewers.viewer">["viewers"], languageCode?: string) => {
    const resolvedNames = await resolveModifierViewerNames({
        languageCode,
        entries: viewers.map((viewer) => ({
            entityType: "viewer" as const,
            entityId: String(viewer.viewer!._id),
            fallbackName: viewer.viewer!.name,
        })),
    });
    return viewers.map((v) => ({
        ...v,
        name: resolvedNames.get(buildModifierViewerTranslationKey("viewer", String(v.viewer!._id)))?.text || v.viewer!.name,
    }));
};
export const handleGeneratePdf = async (req: Request<{
    id: string;
}, never, never, {}>, res: Response<Json<PreviewJobResponse | ErrorResponse>>) => {
    const id = req.params.id;
    if (!id) {
        throw new ApiError(400, "Missing the current invoice id!");
    }
    try {
        const invoices = await getInvoices({
            include: [
                "base_invoice",
                "modifiers.modifier",
                "products.product",
                "viewers.viewer",
                "issuer_company",
                "receiving_customer",
            ],
            where: { _id: { $eq: id } },
            rows: r => r({
                select: []
            })
        });
        const invoice = invoices.rows[0];
        if (!invoice) {
            throw new ApiError(404, `No invoice found with id ${id}`);
        }
        const languageId = invoice.language ? String(invoice.language) : "";
        let translation = DEFAULT_ENGLISH_TEMPLATE;
        const language = languageId ? await Languages.findById(languageId) : null;
        const languageCode = language?.code || "";
        if (language) {
            const partialTranslation = await InvoiceTemplateTranslation.findOne({
                language: language._id,
            }).lean();
            if (partialTranslation) {
                const company = invoice.issuer_company?._id
                    ? await Company.findById(invoice.issuer_company._id).lean()
                    : null;
                const baseCompany = company?.base_company
                    ? await BaseCompany.findById(company.base_company).lean()
                    : null;
                const closingRemark = baseCompany?.closing_remark.find((r) => r.language_code === language.code)?.text ||
                    DEFAULT_ENGLISH_TEMPLATE.closing_remark;
                translation = {
                    ...DEFAULT_ENGLISH_TEMPLATE,
                    ...partialTranslation,
                    closing_remark: closingRemark,
                };
            }
        }
        const productLinesValue = toProductLinesValue(invoice.products);
        const modifierLinesValue = await toModifierLinesValue(invoice.modifiers, languageCode);
        const viewerLinesValue = await toViewerLinesValue(invoice.viewers, languageCode);
        const { currency, total, viewers, modifiers } = await calculateInvoiceState(productLinesValue, modifierLinesValue, viewerLinesValue);
        const resolvedNotes = invoice.notes || "";
        const payload: ResolvedInvoice = {
            currency,
            total,
            viewers,
            modifiers,
            emittedDate: invoice.emitted_date,
            invoiceNumber: invoice.base_invoice!.index,
            notes: resolvedNotes,
            products: await normalizeProductLinesCurrency(productLinesValue, currency),
            issuer_company: {
                _id: invoice.issuer_company!._id,
                name: invoice.issuer_company!.name,
                ...invoice.issuer_company!.details,
            },
            translation,
            receiving_customer: invoice.receiving_customer!.details,
            reportedPeriod: invoice.reported_period,
        };
        const result = await submitJob(req.user!.id, { invoiceId: req.params.id }, payload);
        res.setHeader("X-Preview-Cache", result.cache);
        res.setHeader("Cache-Control", "no-store");
        res.status(result.status === "ready" ? 200 : 202).json(json(result));
    }
    catch (err) {
        throw err;
    }
};
generateRouter.post("/generate/preview", protectRoute(), handleGeneratePreview);
generateRouter.get("/generate/invoice/:id", protectRoute(), handleGeneratePdf);
export default generateRouter;
