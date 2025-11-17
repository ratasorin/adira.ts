import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  createdAt: Date;
}

const UserSchema: Schema<IUser & Document> = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const User: Model<IUser & Document> = mongoose.model<IUser & Document>(
  "User",
  UserSchema,
);

export default User;
