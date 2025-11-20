import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number;
  category: mongoose.Types.ObjectId;
  owner: mongoose.Types.ObjectId; // Reference to User
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema<IProduct & Document> = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User
  stock: { type: Number, required: true, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ProductSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Product: Model<IProduct & Document> = mongoose.model<IProduct & Document>(
  "Product",
  ProductSchema,
);

export default Product;
