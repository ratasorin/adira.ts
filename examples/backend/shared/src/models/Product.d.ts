import { RefTo } from "@n/adira.core.ts";
import { IUser } from "./User";
export interface IProduct {
    _id: unknown;
    name: string;
    description: string;
    price: number;
    category: unknown;
    owner: unknown & RefTo<IUser>;
    stock: number;
    isActive: boolean;
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown;
}
