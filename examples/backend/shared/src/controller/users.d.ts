import { IUser } from "../models/User";
import { Backend } from "@n/adira.core.ts";
import { ErrorResponse } from "../types";
declare const getUsers: Backend.ExecuteGET<IUser, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    name: string;
    email: string;
    createdAt: Date;
    deletedAt?: Date | undefined;
    orders?: (import("@n/adira.core.ts").CleanRef<import("../models/Order").IOrder> | null)[] | undefined;
}>;
declare const createUser: Backend.ExecutePOST<IUser, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    name: string;
    email: string;
    createdAt: Date;
    deletedAt?: Date | undefined;
    orders?: (import("@n/adira.core.ts").CleanRef<import("../models/Order").IOrder> | null)[] | undefined;
}>;
declare const updateUser: Backend.ExecutePATCH<IUser, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    name: string;
    email: string;
    createdAt: Date;
    deletedAt?: Date | undefined;
    orders?: (import("@n/adira.core.ts").CleanRef<import("../models/Order").IOrder> | null)[] | undefined;
}>;
declare const deleteUser: Backend.ExecuteDELETE<IUser, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    name: string;
    email: string;
    createdAt: Date;
    deletedAt?: Date | undefined;
    orders?: (import("@n/adira.core.ts").CleanRef<import("../models/Order").IOrder> | null)[] | undefined;
}>;
export type GetUsersFn = typeof getUsers;
export type CreateUserFn = typeof createUser;
export type UpdateUserFn = typeof updateUser;
export type DeleteUserFn = typeof deleteUser;
