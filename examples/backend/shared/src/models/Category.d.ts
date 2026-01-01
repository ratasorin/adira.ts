export interface ICategory {
    _id: string;
    name: string;
    description: string;
    slug: string;
    parentCategory: string & unknown;
    createdBy: string & unknown;
    isActive: boolean;
    createdAt: unknown;
    updatedAt: unknown;
    deletedAt?: unknown;
}
