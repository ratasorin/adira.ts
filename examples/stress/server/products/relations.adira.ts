import { ProductMini } from "../../contracts/resources";
import { itemNative } from "../orders/items.adira";
import { inventory } from "./inventory.adira";
import { productNative } from "./source.adira";

export const product = itemNative
  .related(productNative, { localField: "productId", foreignField: "_id" })
  .one(ProductMini, { relations: { inventory } });
