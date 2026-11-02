import { RefTo, Serialize } from "@n/adira.core.ts";
export interface IUser {
    _id: string;
    username: string;
    email: string;
    password: string;
    role: "BASIC" | "ADVANCED";
    isVerified: boolean;
    created_by: string & RefTo<IUser>;
    isAdminCreated: boolean;
    deletedAt?: Date | null;
}
