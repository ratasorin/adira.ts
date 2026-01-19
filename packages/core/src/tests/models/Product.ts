export interface IProduct {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  owner: string;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
