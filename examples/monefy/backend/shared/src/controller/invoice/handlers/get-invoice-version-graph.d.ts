import { type Json } from "../../../types/json";
import { IInvoiceChangeLog } from "../../../models/invoice/ChangeLog";
import { ErrorResponse } from "../../../types";
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
