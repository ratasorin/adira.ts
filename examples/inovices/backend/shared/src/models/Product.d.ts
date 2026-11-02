import "./Company";
import { RefTo, Serialize } from "@n/adira.core.ts";
import { IBaseCompany } from "./Company";
export interface IBaseProduct {
    _id: string;
    base_owner_company: string & RefTo<IBaseCompany>;
}
export type Currency = "EUR" | "USD" | "RON" | "GBP";
export interface ProductDetails {
    unit_price: number;
    currency: Currency;
}
export interface IProduct {
    _id: string;
    base_product: string & RefTo<IBaseProduct>;
    primary: boolean;
    hidden: boolean;
    createdAt: Date;
    deletedAt?: Date | null;
    name: string;
    details: ProductDetails;
}
