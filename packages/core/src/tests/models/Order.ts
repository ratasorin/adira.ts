export interface IOrder {
  _id: string;
  user: string; // Reference to User
  products: {
    product: string; // Reference to Product
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
}
