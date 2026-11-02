import mongoose, { Document, Schema } from "mongoose";
import "./Company";
import { RefTo, Serialize } from "@n/adira.core.ts";
import { IBaseCompany, ICompany } from "./Company";
export interface IBaseProduct {
    _id: string;
    base_owner_company: Serialize<mongoose.Types.ObjectId, string> & RefTo<IBaseCompany>;
}
export const baseProductSchema = new Schema<IBaseProduct & Document>({
    base_owner_company: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "BaseCompany",
    },
});
export const BaseProduct = mongoose.model<IBaseProduct & Document>("BaseProduct", baseProductSchema);
export type Currency = "EUR" | "USD" | "RON" | "GBP";
export interface ProductDetails {
    unit_price: number;
    currency: Currency;
}
export interface IProduct {
    _id: string;
    base_product: Serialize<mongoose.Types.ObjectId, string> & RefTo<IBaseProduct>;
    primary: boolean;
    hidden: boolean;
    createdAt: Date;
    deletedAt?: Date | null;
    name: string;
    details: ProductDetails;
}
export const productSchema = new Schema<IProduct & Document>({
    base_product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "BaseProduct",
    },
    name: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    hidden: { type: Boolean, default: false },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now(),
    },
    details: {
        unit_price: { type: Number, required: true },
        currency: {
            type: String,
            enum: ["EUR", "USD", "RON", "GBP"],
            default: "EUR",
        },
    },
    primary: {
        type: Boolean,
        default: false,
    },
});
productSchema.index({ base_product: 1, primary: 1 }, {
    unique: true,
    partialFilterExpression: {
        primary: true,
        deletedAt: null,
    },
});
const Product = mongoose.model<IProduct & Document>("Product", productSchema);
export default Product;
