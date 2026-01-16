import { RefTo } from "@n/adira.core.ts";
import { IUser } from "./User";
import { IProduct } from "./Product";
export interface IOrder {
    _id: unknown;
    user: unknown & RefTo<IUser>;
    products: {
        product: unknown & RefTo<IProduct>;
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
    deletedAt?: Date;
}
