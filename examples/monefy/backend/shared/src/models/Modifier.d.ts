import { Currency } from "./Product";
export interface IModifier {
    _id: string;
    name: string;
    scope: "line" | "total";
    type: "percentage" | "fixed";
    operation: "add" | "subtract";
    value: number;
    currency?: Currency;
}
