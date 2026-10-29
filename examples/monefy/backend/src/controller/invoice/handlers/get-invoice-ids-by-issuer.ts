import { type Json, json } from "../../../types/json";
import { Request, Response } from "express";
import Company from "../../../models/Company";
import Invoice from "../../../models/invoice/Invoice";
import { ErrorResponse } from "../../../types";
import { Backend } from "@n/adira.core.ts";
export const handleGetInvoiceIdsByIssuer = async (_req: Request<never, never, never, {}>, res: Response<Json<{
    groups: {
        [key: string]: string[];
    };
} | ErrorResponse>>) => {
    try {
        const groups = await Invoice.aggregate<{
            _id: string;
            invoiceIds: string[];
        }>([
            {
                $match: {
                    deletedAt: null,
                },
            },
            {
                $sort: {
                    base_invoice: 1,
                    version: -1,
                },
            },
            {
                $group: {
                    _id: "$base_invoice",
                    invoiceId: { $first: "$_id" },
                    issuerCompanyId: { $first: "$issuer_company" },
                },
            },
            {
                $lookup: {
                    from: Company.collection.name,
                    localField: "issuerCompanyId",
                    foreignField: "_id",
                    as: "issuerCompany",
                },
            },
            {
                $unwind: {
                    path: "$issuerCompany",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $group: {
                    _id: {
                        $ifNull: ["$issuerCompany.base_company", "$issuerCompanyId"],
                    },
                    invoiceIds: { $push: "$invoiceId" },
                },
            },
        ]);
        const r = Object.fromEntries(groups.map((group) => [
            String(group._id),
            group.invoiceIds.map((invoiceId) => String(invoiceId)),
        ]));
        res.status(200).send(json({ groups: r }));
    }
    catch (error) {
        throw error;
    }
};
