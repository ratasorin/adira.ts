import { IUser } from "./User";
import { RefTo, Serialize } from "@n/adira.core.ts";
export interface ICategory {
    _id: string;
    name: string;
    description: string;
    slug: string;
    parentCategory: string & RefTo<ICategory>;
    createdBy: string & RefTo<IUser>;
    isActive: boolean;
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown;
}
