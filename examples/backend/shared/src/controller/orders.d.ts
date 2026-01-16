import { IOrder } from "../models/Order";
import { Backend } from "@n/adira.core.ts";
import { ErrorResponse } from "../types";
declare const getOrders: Backend.ExecuteGET<IOrder, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    user: import("@n/adira.core.ts").CleanRef<import("../models/User").IUser> | null;
    products: {
        product: import("@n/adira.core.ts").CleanRef<import("../models/Product").IProduct> | null;
        quantity: number;
        priceAtPurchase: number;
    }[];
    totalAmount: number;
    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    paymentMethod: string;
    paymentStatus: "pending" | "completed" | "failed";
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown | undefined;
}>;
declare const createOrder: Backend.ExecutePOST<IOrder, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    user: import("@n/adira.core.ts").CleanRef<import("../models/User").IUser> | null;
    products: {
        product: import("@n/adira.core.ts").CleanRef<import("../models/Product").IProduct> | null;
        quantity: number;
        priceAtPurchase: number;
    }[];
    totalAmount: number;
    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    paymentMethod: string;
    paymentStatus: "pending" | "completed" | "failed";
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown | undefined;
}>;
declare const updateOrder: Backend.ExecutePATCH<IOrder, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    user: import("@n/adira.core.ts").CleanRef<import("../models/User").IUser> | null;
    products: {
        product: import("@n/adira.core.ts").CleanRef<import("../models/Product").IProduct> | null;
        quantity: number;
        priceAtPurchase: number;
    }[];
    totalAmount: number;
    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    paymentMethod: string;
    paymentStatus: "pending" | "completed" | "failed";
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown | undefined;
}>;
declare const deleteOrder: Backend.ExecuteDELETE<IOrder, {
    _id: import("@n/adira.core.ts").ObjectIdLike;
    user: import("@n/adira.core.ts").CleanRef<import("../models/User").IUser> | null;
    products: {
        product: import("@n/adira.core.ts").CleanRef<import("../models/Product").IProduct> | null;
        quantity: number;
        priceAtPurchase: number;
    }[];
    totalAmount: number;
    status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
    shippingAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    paymentMethod: string;
    paymentStatus: "pending" | "completed" | "failed";
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown | undefined;
}>;
export type GetOrdersFn = typeof getOrders;
export type CreateOrderFn = typeof createOrder;
export type UpdateOrderFn = typeof updateOrder;
export type DeleteOrderFn = typeof deleteOrder;
