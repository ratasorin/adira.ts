import { RefTo } from "@n/adira.core.ts";
import mongoose, { Schema, Document, Model } from "mongoose";
import { IOrder } from "./Order";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  createdAt: Date;
  deletedAt?: Date;
  orders?: (mongoose.Types.ObjectId & RefTo<IOrder>)[]; // References to Orders
}

const UserSchema: Schema<IUser & Document> = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  orders: [{ type: Schema.Types.ObjectId, ref: "Order" }],
});

const User: Model<IUser & Document> = mongoose.model<IUser & Document>(
  "User",
  UserSchema,
);

export default User;
