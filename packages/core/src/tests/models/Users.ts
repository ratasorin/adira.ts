import { ObjectIdLike } from "../../";

export interface IUser {
  _id: ObjectIdLike;
  name: string;
  email: string;
  createdAt: Date;
}
