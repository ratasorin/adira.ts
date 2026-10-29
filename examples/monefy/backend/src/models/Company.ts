import { RefTo, Serialize } from "@n/adira.core.ts";
import mongoose, { Document, Schema } from "mongoose";
import { ILanguage } from "./Languages";
export interface IClosingRemark {
    language_code: string;
    text: string; // e.g. "Thank you for your business"
}
export interface CompanyDetails {
    address: {
        country: string;
        street: string;
        zip: string;
        city: string;
    };
    vat_id: string;
    contact: {
        email: string;
        phone: string;
        fax: string;
        website: string;
    };
    iban: string;
    bic: string;
    bank_name: string; //Bankverbindung
    tax_number: string; // Steuernr
    account_number: string; // Konto Nr.
    bank_code: string; // BLZ
    assets: {
        logo: string;
        signature: string;
        stamp: string;
    };
}
export interface IBaseCompany {
    _id: string;
    closing_remark: IClosingRemark[];
}
export const baseCompanySchema = new Schema<IBaseCompany & Document>({
    closing_remark: {
        type: [
            {
                language_code: { type: String, required: true },
                text: { type: String, required: true },
            },
        ],
        default: [],
        required: true,
    },
});
export const BaseCompany = mongoose.model<IBaseCompany & Document>("BaseCompany", baseCompanySchema);
export interface ICompany {
    _id: string;
    base_company: Serialize<mongoose.Types.ObjectId, string> & RefTo<IBaseCompany>;
    details: CompanyDetails;
    primary: boolean;
    hidden: boolean;
    deletedAt?: Date | null;
    createdAt: Date;
    tags?: string[];
    name: string;
}
export const companySchema = new Schema<ICompany & Document>({
    base_company: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "BaseCompany",
    },
    name: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
    deletedAt: { type: Date, default: null },
    hidden: { type: Boolean, default: false },
    tags: { type: [String], required: false },
    details: {
        address: {
            street: { type: String, required: true },
            zip: { type: String, required: true },
            city: { type: String, required: true },
            country: { type: String, required: true },
        },
        vat_id: { type: String, required: true },
        contact: {
            email: { type: String, required: true },
            phone: { type: String },
            fax: { type: String },
            website: { type: String },
        },
        createdAt: {
            type: Date,
            required: true,
            default: Date.now(),
        },
        iban: { type: String, required: true },
        bic: { type: String, required: true },
        bank_name: { type: String, required: true },
        bank_code: { type: String, required: true },
        account_number: { type: String, required: true },
        tax_number: { type: String, required: true },
        assets: {
            logo: { type: String, required: true },
            signature: { type: String, default: "" },
            stamp: { type: String, default: "" },
        },
    },
    primary: {
        type: Boolean,
        required: true,
        default: false,
    },
});
companySchema.index({ base_company: 1, primary: 1 }, {
    unique: true,
    partialFilterExpression: {
        primary: true,
        deletedAt: null,
    },
});
const Company = mongoose.model<ICompany & Document>("Company", companySchema);
export default Company;
