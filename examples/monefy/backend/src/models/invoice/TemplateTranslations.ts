import mongoose, { Document, Schema } from "mongoose";
import { ILanguage } from "../Languages";
import { RefTo, Serialize } from "@n/adira.core.ts";
export interface IInvoiceTemplateTranslation {
    _id: string;
    language: Serialize<mongoose.Types.ObjectId, string> & RefTo<ILanguage>;
    opening: string; // "Dear Customer," or "Cher Client," or "For," etc.
    invoice: string; // "Invoice" or "Facture" etc.
    table_headers: {
        description: string; // "Description" or "La description" etc.
        quantity: string; // "Quantity" or "Quantité" etc.
        unit_price: string; // "Unit Price" or "Prix unitaire" etc.
        subtotal: string; // "Subtotal" or "Total partiel" etc.
        total: string; // "Total" or "Totale" etc.
    };
    affects: string; // "Affects: #1, #2, #3" etc.
    reported_period: string;
    bank_name: string; // e.g., "Bank Name", "Nom de la banque", etc.
    account_beneficiary: string;
    account_number: string;
    bank_code: string; // e.g., "SWIFT", "BIC", etc.
    thanks: string;
}
const invoiceTemplateTranslation = new Schema<IInvoiceTemplateTranslation & Document>({
    language: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Languages",
    },
    opening: { type: String, required: true },
    invoice: { type: String, required: true },
    table_headers: {
        description: { type: String, required: true },
        quantity: { type: String, required: true },
        unit_price: { type: String, required: true },
        subtotal: { type: String, required: true },
        total: { type: String, required: true },
    },
    affects: { type: String, required: true },
    reported_period: { type: String, required: true },
    bank_name: { type: String, required: true },
    account_beneficiary: { type: String, required: true },
    account_number: { type: String, required: true },
    bank_code: { type: String, required: true },
    thanks: { type: String, required: true },
});
invoiceTemplateTranslation.index({ language: 1 }, { unique: true });
const InvoiceTemplateTranslation = mongoose.model<IInvoiceTemplateTranslation & Document>("InvoiceTemplateTranslation", invoiceTemplateTranslation);
export default InvoiceTemplateTranslation;
