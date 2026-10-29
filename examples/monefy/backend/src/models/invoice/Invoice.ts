import mongoose, { Document, Schema } from "mongoose";
import { PopulatableKeys, RefTo, Serialize } from "@n/adira.core.ts";
import { ICompany } from "../Company";
import { IUser } from "../User";
import { ICustomer } from "../Customer";
import { IModifier } from "../Modifier";
import { IViewer } from "../Viewer";
import { Currency, IProduct } from "../Product";
import { ILanguage } from "../Languages";
import { PopulatableKeys as InferInclude } from "@n/adira.core.ts";
export interface IModifierLine {
    _id: string;
    modifier: Serialize<mongoose.Types.ObjectId, string> & RefTo<IModifier>;
    // if the modifier is global (scope: 'total'), targetLine will be undefined
    targetProductLine?: string[];
    // the order in which the modifier is applied
    index: number;
}
export interface IProductLine {
    _id: string;
    product: Serialize<mongoose.Types.ObjectId, string> & RefTo<IProduct>;
    quantity: number;
    index: number;
}
export interface IViewerLine {
    _id: string;
    viewer: Serialize<mongoose.Types.ObjectId, string> & RefTo<IViewer>;
    // the position to display in the "Modifiers" section of the invoice
    index: number;
    subtotal: number;
    currency: Currency;
}
export interface IBaseInvoice {
    _id: string;
    index: number;
    latest_version: number;
}
export const baseInvoiceSchema = new Schema<IBaseInvoice & Document>({
    index: { type: Number, required: true, immutable: true, unique: true, min: 1, validate: Number.isSafeInteger },
    latest_version: {
        type: Number,
        required: true,
        default: 1,
    },
});
export const BaseInvoice = mongoose.model<IBaseInvoice & Document>("BaseInvoice", baseInvoiceSchema);
export interface IInvoice {
    _id: string;
    base_invoice: Serialize<mongoose.Types.ObjectId, string> & RefTo<IBaseInvoice>;
    reporter: Serialize<mongoose.Types.ObjectId, string> & RefTo<IUser>;
    issuer_company: Serialize<mongoose.Types.ObjectId, string> & RefTo<ICompany>;
    receiving_customer: Serialize<mongoose.Types.ObjectId, string> & RefTo<ICustomer>;
    products: IProductLine[];
    modifiers: IModifierLine[];
    viewers: IViewerLine[];
    notes: string;
    language: Serialize<mongoose.Types.ObjectId, string> & RefTo<ILanguage>;
    from_invoice?: Serialize<mongoose.Types.ObjectId, string> & RefTo<IInvoice>;
    // The date up to which the invoice's products or services are being billed.
    // This typically represents the end of the billing period covered by the invoice.
    reported_period: Date;
    // The date on which the invoice was issued to the customer.
    // This is when the invoice was created and sent out for payment.
    emitted_date: Date;
    total: number;
    currency: Currency;
    deletedAt?: Date | null;
    version: number;
}
export const invoiceSchema = new Schema<IInvoice & Document>({
    issuer_company: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Company",
    },
    total: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        enum: ["EUR", "USD", "RON", "GBP"],
        default: "EUR",
        required: true,
    },
    base_invoice: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "BaseInvoice",
    },
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
    },
    receiving_customer: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Customer",
    },
    notes: { type: String, default: "" },
    language: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Languages",
    },
    from_invoice: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        ref: "Invoice",
        default: null,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    viewers: [
        {
            viewer: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: "Viewer",
            },
            index: { type: Number, required: true },
            _id: { type: String, required: true },
            subtotal: { type: Number, required: true },
            currency: {
                type: String,
                enum: ["EUR", "USD", "RON", "GBP"],
                default: "EUR",
                required: true,
            },
        },
    ],
    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: "Product",
            },
            quantity: { type: Number, required: true },
            index: { type: Number, required: true },
            _id: { type: String, required: true },
        },
    ],
    modifiers: [
        {
            modifier: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: "Modifier",
            },
            targetProductLine: {
                type: [String],
                required: false,
            },
            index: { type: Number, required: true },
            _id: { type: String, required: true },
        },
    ],
    reported_period: { type: Date, required: true },
    emitted_date: { type: Date, required: true },
    version: { type: Number, required: true, default: 0 },
});
invoiceSchema.index({ base_invoice: 1, version: 1 }, {
    unique: true,
    partialFilterExpression: { deletedAt: null },
});
const Invoice = mongoose.model<IInvoice & Document>("Invoice", invoiceSchema);
export default Invoice;
