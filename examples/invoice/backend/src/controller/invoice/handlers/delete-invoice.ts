import { type Json, json } from "../../../types/json";
import { Request, Response } from "express";
import { Types } from "mongoose";
import Invoice from "../../../models/invoice/Invoice";
import { ErrorResponse } from "../../../types";
import { deleteInvoice } from "../base";
export const handleDeleteInvoice = async (req: Request<{
    id: string;
}, never, {}, {}>, res: Response<Json<ErrorResponse | {
    error: false;
}>>) => {
    try {
        await deleteInvoice(req.params.id, {}, {
            softDelete: async () => {
                await Invoice.findByIdAndUpdate(new Types.ObjectId(req.params.id), {
                    deletedAt: new Date(Date.now()),
                });
            },
        });
        res.send(json({ error: false }));
    }
    catch (error) {
        throw error;
    }
};
