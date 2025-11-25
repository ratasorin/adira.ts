import type { ObjectIdLike } from "@n/adira.core.ts";
import "mongoose";

declare module "mongoose" {
  namespace Types {
    interface ObjectId extends ObjectIdLike {}
  }
}
