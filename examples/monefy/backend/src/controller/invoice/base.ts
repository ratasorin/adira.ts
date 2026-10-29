import { protectInputKeys } from "../../middleware/input";
import { buildDeleteHandler, buildGetHandler, buildPatchHandler, buildPostHandler, } from "@n/adira.backend.ts";
import Invoice from "../../models/invoice/Invoice";
export const getInvoices = buildGetHandler(Invoice);
export const postInvoice = buildPostHandler(Invoice), sanitizePostInvoicePayload = protectInputKeys([
    "currency",
    "from_invoice",
    "reporter",
    "version",
    "deletedAt",
    "viewers.currency",
    "viewers.subtotal",
    "_id",
    "total",
]);
export const patchInvoice = buildPatchHandler(Invoice), sanitizePatchInvoicePayload = protectInputKeys([
    "currency",
    "total",
    "from_invoice",
    "reporter",
    "version",
    "deletedAt",
    "base_invoice",
    "viewers.currency",
    "viewers.subtotal",
    "_id",
]);
export const deleteInvoice = buildDeleteHandler(Invoice);
export type GetInvoicesFn = typeof getInvoices;
export type PatchInvoiceFn = typeof patchInvoice;
export type PostInvoiceFn = typeof postInvoice;
