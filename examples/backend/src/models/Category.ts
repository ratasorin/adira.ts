import { ObjectIdLike } from "@n/adira.core.ts";
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  slug: string;
  parentCategory: ObjectIdLike; // Reference to another Category for hierarchy
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema: Schema<ICategory & Document> = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  slug: { type: String, required: true, unique: true },
  parentCategory: { type: Schema.Types.ObjectId, ref: "Category" }, // For hierarchical categories
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
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
