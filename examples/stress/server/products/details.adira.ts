import {
  ProductResource,
  readLimits as limits,
} from "../../contracts/resources";
import { reads } from "../read-context";
import { inventory } from "./inventory.adira";
import { productSource } from "./replenishment.adira";

export const readProducts = reads.defineRead(ProductResource, {
  source: productSource,
  relations: { inventory },
  limits,
});
