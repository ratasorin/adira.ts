import { ObjectIdLike } from "../../";

export interface IProduct {
  _id: ObjectIdLike;
  name: string;
  description: string;
  price: number;
  category: ObjectIdLike;
  owner: ObjectIdLike;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
