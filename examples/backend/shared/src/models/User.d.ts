import { RefTo, Serialize } from "@n/adira.core.ts";
import { IOrder } from "./Order";
export interface IUser {
    _id: string;
    name: string;
    email: string;
    createdAt: Date;
    deletedAt?: Date;
    orders?: (string & RefTo<IOrder>)[];
}
