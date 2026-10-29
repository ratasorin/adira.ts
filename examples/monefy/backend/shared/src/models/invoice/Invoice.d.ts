import { RefTo, Serialize } from "@n/adira.core.ts";
import { ICompany } from "../Company";
import { IUser } from "../User";
import { ICustomer } from "../Customer";
import { IModifier } from "../Modifier";
import { IViewer } from "../Viewer";
import { Currency, IProduct } from "../Product";
import { ILanguage } from "../Languages";
export interface IModifierLine {
    _id: string;
    modifier: string & RefTo<IModifier>;
    targetProductLine?: string[];
    index: number;
}
export interface IProductLine {
    _id: string;
    product: string & RefTo<IProduct>;
    quantity: number;
    index: number;
}
export interface IViewerLine {
    _id: string;
    viewer: string & RefTo<IViewer>;
    index: number;
    subtotal: number;
    currency: Currency;
}
export interface IBaseInvoice {
    _id: string;
    index: number;
    latest_version: number;
}
export interface IInvoice {
    _id: string;
    base_invoice: string & RefTo<IBaseInvoice>;
    reporter: string & RefTo<IUser>;
    issuer_company: string & RefTo<ICompany>;
    receiving_customer: string & RefTo<ICustomer>;
    products: IProductLine[];
    modifiers: IModifierLine[];
    viewers: IViewerLine[];
    notes: string;
    language: string & RefTo<ILanguage>;
    from_invoice?: string & RefTo<IInvoice>;
    reported_period: Date;
    emitted_date: Date;
    total: number;
    currency: Currency;
    deletedAt?: Date | null;
    version: number;
}
