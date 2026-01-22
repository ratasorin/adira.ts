import { RefTo } from "../..";
import { IUser } from "./Users";
export interface ICategory {
    _id: string;
    name: string;
    description: string;
    slug: string;
    parentCategory: string;
    createdBy: string & RefTo<IUser>;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
