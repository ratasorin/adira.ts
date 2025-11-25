import { ObjectIdLike, RefTo } from "../..";
import { IUser } from "./Users";

export interface ICategory {
  _id: ObjectIdLike;
  name: string;
  description: string;
  slug: string;
  parentCategory: ObjectIdLike & RefTo<ICategory>;
  createdBy: ObjectIdLike & RefTo<IUser>;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
