import mongoose, { Schema, Document, Model } from "mongoose";
import { IUser } from "./User";
import { RefTo } from "@n/adira.core.ts";

export interface ICategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  slug: string;
  parentCategory: mongoose.Types.ObjectId & RefTo<ICategory>;
  createdBy: mongoose.Types.ObjectId & RefTo<IUser>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const CategorySchema: Schema<ICategory & Document> = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  slug: { type: String, required: true, unique: true },
  parentCategory: { type: Schema.Types.ObjectId, ref: "Category" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
});

CategorySchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
CategorySchema.index({ slug: 1 });
CategorySchema.index({ parentCategory: 1 });

const Category: Model<ICategory & Document> = mongoose.model<
  ICategory & Document
>("Category", CategorySchema);

export default Category;
