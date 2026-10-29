import { type Json, json } from "../../types/json";
import express, { Request, Response } from "express";
import { buildGetHandler, buildPatchHandler, buildPostHandler, buildDeleteHandler, } from "@n/adira.backend.ts";
import { Backend } from "@n/adira.core.ts";
import InvoiceChangeLog from "../../models/invoice/ChangeLog";
import { ErrorResponse } from "../../types";
export const getInvoiceChangeLogs = buildGetHandler(InvoiceChangeLog);
export const createInvoiceChangeLog = buildPostHandler(InvoiceChangeLog);
export type GetInvoiceChangeLogsExecutor = typeof getInvoiceChangeLogs;
export const handleGetInvoiceChangeLogs = async (req: Request<never, never, never, Backend.InferHandlerParams<GetInvoiceChangeLogsExecutor>>, res: Response<Json<Backend.InferHandlerResponse<GetInvoiceChangeLogsExecutor> | ErrorResponse>>) => {
    try {
        const rows = await getInvoiceChangeLogs(req.query);
        res.send(json(rows));
    }
    catch (error) {
        throw error;
    }
};
