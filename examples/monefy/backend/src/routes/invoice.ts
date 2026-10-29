import { nextInvoiceNumber } from "../controller/invoice/utils/next-invoice-number";
import { jobStatus, artifact } from "../controller/invoice/artifacts";
import { type Json, json } from "../types/json";
import { Request, Response, Router } from "express";
import { protectRoute } from "../middleware/auth";
import { ErrorResponse } from "../types";
import { Counter } from "../models/Counter";
import { handleDeleteInvoice, handleGetInvoices, handleGetInvoiceIdsByIssuer, handleGetInvoiceVersionGraph, handlePatchInvoice, handlePostInvoice, handleCheckInvoiceNumberAvailability, sanitizePatchInvoicePayload, sanitizePostInvoicePayload, } from "../controller/invoice";
import { Backend } from "@n/adira.core.ts";
import { ApiError } from "../utils/api-errors";
import { asyncHandler } from "../middleware/async-handler";
const invoiceRouter = Router();
export const handleDraftInvoiceNumber = async (req: Request<{
    base_company_id?: string;
}, never, never, {}>, res: Response<Json<{
    seqNum: number;
} | ErrorResponse>>) => {
    const { base_company_id } = req.params;
    if (!base_company_id) {
        throw new ApiError(400, "The base company scope was not provided!");
    }
    try {
        const counter = await Counter.findOne({ scope: base_company_id })
            .select({ value: 1 })
            .lean();
        const seqNum = counter?.value || 0;
        res.json(json({ seqNum: await nextInvoiceNumber(seqNum) }));
        return;
    }
    catch (e) {
        throw e;
    }
};
invoiceRouter.get("/invoices", protectRoute(), handleGetInvoices);
invoiceRouter.get("/invoice-groups/by-issuer", protectRoute(), handleGetInvoiceIdsByIssuer);
invoiceRouter.get("/invoices/availability/number", protectRoute(), handleCheckInvoiceNumberAvailability);
invoiceRouter.post("/invoices", protectRoute(), sanitizePostInvoicePayload, handlePostInvoice);
invoiceRouter.get("/invoices/:id/version-graph", protectRoute(), handleGetInvoiceVersionGraph);
invoiceRouter.patch("/invoices/:id", protectRoute(), sanitizePatchInvoicePayload, handlePatchInvoice);
invoiceRouter.delete("/invoices/:id", protectRoute(), handleDeleteInvoice);
invoiceRouter.get("/draft/invoices/seqnum/:base_company_id", protectRoute(), handleDraftInvoiceNumber);
invoiceRouter.get("/invoice/jobs/:id", protectRoute(), jobStatus);
invoiceRouter.get("/invoice/artifacts/:id", protectRoute(), artifact);
export default invoiceRouter;
