import type { IInvoice, IViewerLine } from "../../../models/invoice/Invoice";
import type { Json } from "../../../types/json";
import { CompanyDetails } from "../../../models/Company";
import { CustomerDetails } from "../../../models/Customer";
import { Currency } from "../../../models/Product";
export interface IProductLineValue {
    _id: string;
    product: {
        name: string;
        price: number;
        currency: Currency;
    };
    quantity: number;
}
export interface IViewerLineValue {
    index: number;
    name: string;
}
export interface IModifierLineBase {
    value: number;
    name: string;
    index: number;
    operation: "add" | "subtract";
}
type ModifierForType = {
    type: "fixed";
    currency: Currency;
} | {
    type: "percentage";
};
type ModifierForScope = {
    scope: "line";
    targetProductLine?: string[];
} | {
    scope: "total";
};
export type IModifierLineValue = IModifierLineBase & ModifierForType & ModifierForScope;
export interface InvoiceDraft {
    issuer_company?: CompanyDetails & {
        name: string;
        _id: string;
    };
    receiving_customer?: CustomerDetails;
    products?: IProductLineValue[];
    modifiers?: IModifierLineValue[];
    viewers?: IViewerLineValue[];
    notes?: string;
    invoiceNumber?: number;
    emittedDate?: Date | string;
    reportedPeriod?: Date | string;
    language_id?: string;
}
export type InvoiceInput = Pick<Json<IInvoice>, "base_invoice" | "issuer_company" | "receiving_customer" | "products" | "modifiers" | "notes" | "language" | "reported_period" | "emitted_date"> & {
    viewers: Pick<Json<IViewerLine>, "_id" | "viewer" | "index">[];
};
