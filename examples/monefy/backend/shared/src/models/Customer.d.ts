import { RefTo, Serialize } from "@n/adira.core.ts";
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
export interface ICustomer {
    _id: string;
    base_customer: string & RefTo<IBaseCustomer>;
    primary: boolean;
    details: CustomerDetails;
    createdAt: Date;
    deletedAt?: Date | null;
    tags?: string[];
}
