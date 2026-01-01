export interface IProduct {
    _id: unknown;
    name: string;
    description: string;
    price: number;
    category: unknown;
    owner: unknown & unknown;
    stock: number;
    isActive: boolean;
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown;
}
