import { RefTo, Serialize } from "@n/adira.core.ts";
import mongoose, { Document, Schema } from "mongoose";
export interface CustomerDetails {
    selected_name: string;
    city: string;
    country: string;
    address: string;
    cif: string;
}
export interface IBaseCustomer {
    _id: string;
    internal_name: string;
}
export const baseCustomerSchema = new Schema<IBaseCustomer & Document>({
    internal_name: { type: String, required: true, unique: true },
});
export const BaseCustomer = mongoose.model<IBaseCustomer & Document>("BaseCustomer", baseCustomerSchema);
export interface ICustomer {
    _id: string;
    base_customer: Serialize<mongoose.Types.ObjectId, string> & RefTo<IBaseCustomer>;
    primary: boolean;
    details: CustomerDetails;
    createdAt: Date;
    deletedAt?: Date | null;
    tags?: string[];
}
export const customerSchema = new Schema<ICustomer & Document>({
    base_customer: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "BaseCustomer",
    },
    tags: { type: [String], required: false },
    deletedAt: { type: Date, default: null },
    details: {
        selected_name: {
            required: true,
            type: String,
        },
        city: {
            required: true,
            type: String,
        },
        country: {
            required: true,
            type: String,
        },
        address: {
            required: true,
            type: String,
        },
        cif: {
            required: true,
            type: String,
        },
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now(),
    },
    primary: {
        type: Boolean,
        default: false,
    },
});
customerSchema.index({ base_customer: 1, primary: 1 }, {
    unique: true,
    partialFilterExpression: {
        primary: true,
        deletedAt: null,
    },
});
const Customer = mongoose.model<ICustomer & Document>("Customer", customerSchema);
export default Customer;
