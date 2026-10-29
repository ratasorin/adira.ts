import mongoose, { Document, Schema } from "mongoose";
import { RefTo, Serialize } from "@n/adira.core.ts";
import { IBaseInvoice } from "./Invoice";
import { IUser } from "../User";
export type ChangeType = "modification" | "addition" | "removal";
export type DiffPrimitive = string | number | boolean | null;
export type DiffObject = object;
export type DiffValue = DiffPrimitive | DiffObject;
export interface IInvoiceChange {
    field: string;
    old_value?: DiffValue | null;
    new_value?: DiffValue | null;
    type: ChangeType;
}
export interface IInvoiceChangeLog {
    base_invoice: Serialize<mongoose.Types.ObjectId, string> & RefTo<IBaseInvoice>;
    version: number;
    changes: IInvoiceChange[];
    changed_by: Serialize<mongoose.Types.ObjectId, string> & RefTo<IUser>;
    changed_at: Date;
}
const invoiceChangeLogSchema = new Schema<IInvoiceChangeLog & Document>({
    base_invoice: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "BaseInvoice",
    },
    changes: [
        {
            field: { type: String, required: true },
            old_value: { type: Schema.Types.Mixed, default: null },
            new_value: { type: Schema.Types.Mixed, default: null },
            type: {
                type: String,
                enum: ["modification", "addition", "removal"],
                required: true,
            },
        },
    ],
    changed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    version: { type: Number, required: true },
    changed_at: { type: Date, default: Date.now, required: true },
});
invoiceChangeLogSchema.index({ base_invoice: 1, version: 1 }, { unique: true });
const InvoiceChangeLog = mongoose.model<IInvoiceChangeLog & Document>("InvoiceChangeLog", invoiceChangeLogSchema);
export default InvoiceChangeLog;
