export interface IOrder {
    _id: unknown;
    user: unknown & unknown;
    products: {
        product: unknown & unknown;
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
