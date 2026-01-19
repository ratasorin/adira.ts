import { RefTo, Serialize } from "@n/adira.core.ts";
import { IUser } from "./User";
export interface IProduct {
    _id: string;
    name: string;
    description: string;
    price: number;
    category: string;
    owner: string & RefTo<IUser>;
    stock: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
}
