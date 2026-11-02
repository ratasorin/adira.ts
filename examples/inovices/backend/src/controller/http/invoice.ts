import { Request,Response } from "express";
import { nextInvoiceNumber } from "../../controller/invoice/utils/next-invoice-number";
import { Counter } from "../../models/Counter";
import { ErrorResponse } from "../../types";
import { type Json,json } from "../../types/json";
import { ApiError } from "../../utils/api-errors";
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
