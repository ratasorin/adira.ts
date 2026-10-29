import { type Json, json } from "../../../types/json";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { BaseInvoice } from "../../../models/invoice/Invoice";
import { ErrorResponse } from "../../../types";
import { ApiError } from "../../../utils/api-errors";
export const handleCheckInvoiceNumberAvailability = async (req: Request<never, never, never, {
    index?: number;
    baseInvoiceId?: string;
}>, res: Response<Json<{
    available: boolean;
    takenByBaseInvoiceId?: string;
} | ErrorResponse>>) => {
    try {
        const index = Number(req.query.index);
        const baseInvoiceId = String(req.query.baseInvoiceId || "");
        if (!Number.isFinite(index) || index <= 0) {
            throw new ApiError(400, "index must be a positive number");
        }
        const existing = await BaseInvoice.findOne({ index })
            .select({ _id: 1 })
            .lean();
        if (!existing) {
            res.status(200).send(json({ available: true }));
            return;
        }
        const available = baseInvoiceId
            ? String(existing._id) === baseInvoiceId
            : false;
        res.status(200).send(json({
            available,
            takenByBaseInvoiceId: available ? undefined : String(existing._id),
        }));
    }
    catch (error) {
        throw error;
    }
};
