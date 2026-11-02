import { defineResource, field, type ResourceLike } from "@n/adira.core.ts";
import {
  defineRead,
  type AppPlan,
  type AppRelationPlan,
  type CompatibleResource,
  type ReaderOptions,
} from "../read";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

declare const source: AppPlan<{
  stock: 1;
  status: "active";
  privateValue: string;
}>;
declare const relation: AppRelationPlan<
  { id: string },
  { stock: 1; status: "active" }
>;
const Stock = defineResource({ stock: field.number() });
const NullableStock = defineResource({ stock: field.number().nullable() });
const Status = defineResource({ status: field.enum(["active", "paused"]) });

const read = defineRead(Stock, { source });
const result = read({ select: { stock: true } });
type PublicNumber = Expect<
  Equal<Awaited<typeof result>["rows"][number], { readonly stock: number }>
>;
const nullable = relation.one(NullableStock).get({ select: { stock: true } });
type PublicNullable = Expect<
  Equal<(typeof nullable)["__value"], { readonly stock: number | null } | null>
>;
const status = relation.one(Status).get({ select: { status: true } });
type PublicEnum = Expect<
  Equal<
    (typeof status)["__value"],
    { readonly status: "active" | "paused" } | null
  >
>;
// @ts-expect-error Source-only fields cannot leak into public selections.
read({ select: { privateValue: true } });

// Generic wrappers can retain and forward the binding's shape constraint.
function forward<R extends ResourceLike, Row extends object, Context>(
  resource: CompatibleResource<R, Row>,
  options: ReaderOptions<R, Row, Context>,
) {
  return defineRead<R, Row, Context>(resource, options);
}
const forwarded = forward(Stock, { source });
type ForwardedResource = Expect<
  Equal<(typeof forwarded)["__resource"], typeof Stock>
>;
