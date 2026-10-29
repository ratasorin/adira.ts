import mongoose, { Document, Schema } from "mongoose";
import { RefTo, Serialize } from "@n/adira.core.ts";
import { IProduct } from "../Product";
export interface IInvoiceProductLine {
    _id: string;
    product: Serialize<mongoose.Types.ObjectId, string> & RefTo<IProduct>;
    quantity: number;
    index: number;
}
export const invoiceProductLineSchema = new Schema<IInvoiceProductLine & Document>({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Product",
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
    },
    index: {
        type: Number,
        require: true,
        default: 0,
    },
});
const InvoiceProductLine = mongoose.model<IInvoiceProductLine & Document>("InvoiceProductLine", invoiceProductLineSchema);
export default InvoiceProductLine;
