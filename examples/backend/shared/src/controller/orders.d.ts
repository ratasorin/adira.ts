import { Backend } from "@n/adira.core.ts";
declare const getOrders: Backend.ExecuteGET<unknown, {
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
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | undefined;
}>;
declare const createOrder: Backend.ExecutePOST<unknown, {
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
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | undefined;
}>;
declare const updateOrder: Backend.ExecutePATCH<unknown, {
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
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | undefined;
}>;
declare const deleteOrder: Backend.ExecuteDELETE<unknown, {
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
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | undefined;
}>;
export type GetOrdersFn = typeof getOrders;
export type CreateOrderFn = typeof createOrder;
export type UpdateOrderFn = typeof updateOrder;
export type DeleteOrderFn = typeof deleteOrder;
