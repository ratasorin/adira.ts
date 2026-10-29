import { type Json, json } from "../../../types/json";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { getInvoices, GetInvoicesFn } from "../base";
import { ErrorResponse } from "../../../types";
export const handleGetInvoices = async (req: Request<never, never, never, Backend.InferHandlerParams<GetInvoicesFn>>, res: Response<Json<Backend.InferHandlerResponse<GetInvoicesFn> | ErrorResponse>>) => {
    try {
        const invoices = await getInvoices(req.query);
        res.status(200).send(json(invoices));
    }
    catch (error) {
        throw error;
    }
};
