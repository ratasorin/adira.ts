import { RefTo, Serialize } from "@n/adira.core.ts";
import { IBaseInvoice } from "./Invoice";
import { IUser } from "../User";
export type ChangeType = "modification" | "addition" | "removal";
export type DiffPrimitive = string | number | boolean | null;
export type DiffObject = object;
export type DiffValue = DiffPrimitive | DiffObject;
export interface IInvoiceChange {
    field: string;
    old_value?: DiffValue | null;
    new_value?: DiffValue | null;
    type: ChangeType;
}
export interface IInvoiceChangeLog {
    base_invoice: string & RefTo<IBaseInvoice>;
    version: number;
    changes: IInvoiceChange[];
    changed_by: string & RefTo<IUser>;
    changed_at: Date;
}
