import { RefTo, Serialize } from "@n/adira.core.ts";
import mongoose, { Schema, Document, Model } from "mongoose";
import { IOrder } from "./Order";

export interface IUser {
  _id: Serialize<mongoose.Types.ObjectId, string>;
  name: string;
  email: string;
  createdAt: Date;
  deletedAt?: Date;
  orders?: (Serialize<mongoose.Types.ObjectId, string> & RefTo<IOrder>)[]; // References to Orders
}

const UserSchema: Schema<IUser & Document> = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});

const User: Model<IUser & Document> = mongoose.model<IUser & Document>(
  "User",
  UserSchema,
);

export default User;
