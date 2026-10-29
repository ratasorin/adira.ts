import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import { handleAllocateBaseInvoice, handleGetBaseInvoice, handlePostBaseInvoice, sanitizePostBaseInvoicePayload, } from "../controller/base-invoice";
const baseInvoiceRouter = Router();
baseInvoiceRouter.get("/base-invoices/:id", protectRoute(), handleGetBaseInvoice);
baseInvoiceRouter.post("/base-invoices/allocate/:base_company_id", protectRoute(), handleAllocateBaseInvoice);
baseInvoiceRouter.post("/base-invoices", protectRoute(), sanitizePostBaseInvoicePayload, handlePostBaseInvoice);
export default baseInvoiceRouter;
