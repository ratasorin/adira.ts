import mongoose, { Schema, Types } from "mongoose";
import { defineResource, field, schema } from "@n/adira.core.ts";
import { defineRead, mongo } from "../read";

export interface CreatorRow {
  _id: Types.ObjectId;
  name: string;
  deletedAt: Date | null;
}
export interface CategoryRow {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  tenant: string;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  subtotal: number;
  tax: number;
}
export interface ProductRow {
  _id: Types.ObjectId;
  category: Types.ObjectId;
  name: string;
  stock: number;
  isActive: boolean;
}

export const Creators = mongoose.model<CreatorRow>(
  "ComposableCreator",
  new Schema<CreatorRow>({
    name: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  }),
);
export const Categories = mongoose.model<CategoryRow>(
  "ComposableCategory",
  new Schema<CategoryRow>({
    name: String,
    slug: String,
    tenant: String,
    isActive: Boolean,
    createdBy: Schema.Types.ObjectId,
    subtotal: Number,
    tax: Number,
  }),
);
export const Products = mongoose.model<ProductRow>(
  "ComposableProduct",
  new Schema<ProductRow>({
    category: Schema.Types.ObjectId,
    name: String,
    stock: Number,
    isActive: Boolean,
  }),
);

export const CreatorResource = defineResource({
  id: field.string().orderable(),
  name: field.string().filterable("$startsWith"),
  displayName: field.string(),
  initials: field.string(),
});
export const ProductResource = defineResource({
  id: field.string().orderable(),
  name: field.string().filterable("$startsWith"),
  stock: field.number().filterable("$gte").orderable(),
});
export const CategoryResource = defineResource(
  {
    id: field.string().orderable(),
    name: field.string().filterable("$eq", "$startsWith", "$in"),
    slug: field.string(),
    isActive: field.boolean().filterable("$eq"),
    total: field.number().filterable("$gte", "$lt").orderable(),
    displayName: field.string().orderable(),
    createdBy: field.one(CreatorResource).nullable(),
    products: field.many(ProductResource),
  },
  {
    predicates: {
      eligible: field.boolean().filterable("$eq"),
      hasAvailableProducts: field.boolean().filterable("$eq"),
    },
  },
);

export const calls = { initials: 0, displayName: 0, eligible: 0 };
export const creatorSource = mongo
  .from(Creators)
  .where((e) => e.isNull(e.field("deletedAt")))
  .derive("id", (e) => e.toString(e.field("_id")))
  .derive("displayName", (e) => e.upper(e.field("name")))
  .toApp({ batchSize: 2, concurrency: 2 })
  .derive("initials", ["name"], async (user) => {
    calls.initials++;
    return user.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("");
  });
export const productSource = mongo
  .from(Products)
  .derive("id", (e) => e.toString(e.field("_id")));
export const categorySource = mongo
  .from(Categories)
  .derive("id", (e) => e.toString(e.field("_id")))
  .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
  .sortBy({ _id: 1 })
  .toApp({ batchSize: 2, concurrency: 2 })
  .derive("displayName", ["name", "isActive"], (category) => {
    calls.displayName++;
    return category.isActive ? category.name : `${category.name} (inactive)`;
  });

export const relations = {
  createdBy: categorySource.one(CreatorResource, {
    plan: creatorSource,
    localField: "createdBy",
    foreignField: "_id",
  }),
  products: categorySource.many(ProductResource, {
    plan: productSource,
    localField: "_id",
    foreignField: "category",
  }),
};
const objectId = schema.custom<Types.ObjectId>((value) => {
  if (!(value instanceof Types.ObjectId))
    throw new Error("Expected an ObjectId");
  return value;
});

export const filters = {
  eligible: {
    $eq: (expected: boolean) =>
      categorySource.appCondition({
        requires: ["name", "isActive"],
        evaluate: (category) => {
          calls.eligible++;
          return (category.isActive && category.name.length >= 5) === expected;
        },
      }),
  },
  hasAvailableProducts: {
    $eq: (expected: boolean) =>
      categorySource.pipelineCondition({
        requires: ["_id"],
        preservesRows: true,
        stages: [
          {
            $lookup: {
              from: Products.collection.name,
              localField: "_id",
              foreignField: "category",
              pipeline: [
                { $match: { isActive: true, stock: { $gt: 0 } } },
                { $limit: 1 },
                { $project: { _id: 1 } },
              ],
              as: "matchingProducts",
            },
          },
        ],
        output: schema.object({
          matchingProducts: schema.array(schema.object({ _id: objectId })),
        }),
        test: (e) =>
          e.eq(e.gt(e.size(e.field("matchingProducts")), 0), expected),
      }),
  },
};

export const getCategories = defineRead(CategoryResource, {
  source: categorySource,
  relations,
  filters,
  scope: () => categorySource.condition((e) => e.eq(e.field("tenant"), "demo")),
});

export const ids = {
  ana: new Types.ObjectId("000000000000000000000101"),
  dan: new Types.ObjectId("000000000000000000000102"),
  deleted: new Types.ObjectId("000000000000000000000103"),
  art: new Types.ObjectId("000000000000000000000001"),
  games: new Types.ObjectId("000000000000000000000002"),
  books: new Types.ObjectId("000000000000000000000003"),
  audio: new Types.ObjectId("000000000000000000000004"),
  hidden: new Types.ObjectId("000000000000000000000005"),
};

export async function seed(): Promise<void> {
  await Promise.all([
    Creators.deleteMany({}),
    Categories.deleteMany({}),
    Products.deleteMany({}),
  ]);
  await Creators.insertMany([
    { _id: ids.ana, name: "Ana Pop", deletedAt: null },
    { _id: ids.dan, name: "Dan Ionescu", deletedAt: null },
    { _id: ids.deleted, name: "Deleted User", deletedAt: new Date() },
  ]);
  await Categories.insertMany([
    {
      _id: ids.art,
      name: "Art",
      slug: "art",
      tenant: "demo",
      isActive: false,
      createdBy: ids.ana,
      subtotal: 10,
      tax: 2,
    },
    {
      _id: ids.games,
      name: "Games",
      slug: "games",
      tenant: "demo",
      isActive: false,
      createdBy: ids.deleted,
      subtotal: 20,
      tax: 4,
    },
    {
      _id: ids.books,
      name: "Books",
      slug: "books",
      tenant: "demo",
      isActive: true,
      createdBy: ids.dan,
      subtotal: 30,
      tax: 6,
    },
    {
      _id: ids.audio,
      name: "Audio",
      slug: "audio",
      tenant: "demo",
      isActive: true,
      createdBy: ids.ana,
      subtotal: 40,
      tax: 8,
    },
    {
      _id: ids.hidden,
      name: "Alien",
      slug: "hidden",
      tenant: "other",
      isActive: true,
      createdBy: ids.ana,
      subtotal: 100,
      tax: 20,
    },
  ]);
  await Products.insertMany([
    { category: ids.books, name: "Book A", stock: 3, isActive: true },
    { category: ids.books, name: "Book B", stock: 7, isActive: true },
    { category: ids.games, name: "Game", stock: 10, isActive: false },
    { category: ids.audio, name: "Headphones", stock: 0, isActive: true },
  ]);
  Object.assign(calls, { initials: 0, displayName: 0, eligible: 0 });
}
