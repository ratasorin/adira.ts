import { type Json, json } from "../../../types/json";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import InvoiceChangeLog, { IInvoiceChangeLog, } from "../../../models/invoice/ChangeLog";
import Invoice from "../../../models/invoice/Invoice";
import { ErrorResponse } from "../../../types";
import { ApiError } from "../../../utils/api-errors";
type InvoiceVersionGraphNode = {
    id: string;
    version: number;
    language?: {
        _id: string;
        code: string;
        name: string;
    } | null;
    from_invoice?: string | null;
    emitted_date: Date;
};
type InvoiceVersionGraphEdge = {
    source: string;
    target: string;
    version: number;
    changed_at?: Date;
    changed_by?: string;
    changes: IInvoiceChangeLog["changes"];
};
export const handleGetInvoiceVersionGraph = async (req: Request<{
    id: string;
}, never, never, {}>, res: Response<Json<{
    nodes: Record<string, InvoiceVersionGraphNode>;
    adjacency: Record<string, InvoiceVersionGraphEdge[]>;
    root_ids: string[];
    current_invoice_id: string;
} | ErrorResponse>>) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .select({ _id: 1, base_invoice: 1 })
            .lean();
        if (!invoice) {
            throw new ApiError(404, "Invoice not found");
        }
        const invoices = await Invoice.find({
            base_invoice: invoice.base_invoice,
            deletedAt: null,
        })
            .populate("language", "_id code name")
            .select({
            _id: 1,
            version: 1,
            language: 1,
            from_invoice: 1,
            emitted_date: 1,
        })
            .lean();
        const changeLogs = await InvoiceChangeLog.find({
            base_invoice: invoice.base_invoice,
        })
            .populate("changed_by", "_id username")
            .select({ version: 1, changes: 1, changed_at: 1, changed_by: 1 })
            .lean();
        const logByVersion = new Map(changeLogs.map((log) => [log.version, log]));
        const nodes: Record<string, InvoiceVersionGraphNode> = {};
        const adjacency: Record<string, InvoiceVersionGraphEdge[]> = {};
        const rootIds: string[] = [];
        for (const row of invoices) {
            const id = String(row._id);
            const fromInvoice = row.from_invoice ? String(row.from_invoice) : null;
            const populatedLanguage = row.language && typeof row.language === "object"
                ? (row.language as unknown as {
                    _id: string;
                    code?: string;
                    name?: string;
                })
                : null;
            nodes[id] = {
                id,
                version: row.version,
                language: populatedLanguage
                    ? {
                        _id: String(populatedLanguage._id),
                        code: String(populatedLanguage.code || ""),
                        name: String(populatedLanguage.name || populatedLanguage.code || ""),
                    }
                    : null,
                from_invoice: fromInvoice,
                emitted_date: row.emitted_date,
            };
            if (!fromInvoice) {
                rootIds.push(id);
                continue;
            }
            const log = logByVersion.get(row.version);
            if (!adjacency[fromInvoice]) {
                adjacency[fromInvoice] = [];
            }
            adjacency[fromInvoice].push({
                source: fromInvoice,
                target: id,
                version: row.version,
                changed_at: log?.changed_at,
                changed_by: log?.changed_by && typeof log.changed_by === "object"
                    ? String((log.changed_by as unknown as {
                        _id: string;
                        username?: string;
                    }).username || log.changed_by)
                    : undefined,
                changes: log?.changes || [],
            });
        }
        for (const key of Object.keys(adjacency)) {
            adjacency[key] = adjacency[key]!.sort((a, b) => a.version - b.version);
        }
        res.status(200).json(json({
            nodes,
            adjacency,
            root_ids: rootIds,
            current_invoice_id: String(invoice._id),
        }));
    }
    catch (error) {
        throw error;
    }
};
