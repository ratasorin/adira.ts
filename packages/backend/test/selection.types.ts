import {
  defineResource,
  field,
  type ReadData,
  type ReadQuery,
} from "@n/adira.core.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
const Child = defineResource({
  name: field.string(),
  amount: field.number().nullable(),
});
const Parent = defineResource({
  name: field.string(),
  count: field.number(),
  child: field.one(Child).nullable(),
  children: field.many(Child),
});
type Resource = typeof Parent;
declare const visible: boolean;
// Compatibility coverage for callers that still author conditional object spreads.
const conditional = {
  select: {
    ...(visible ? { name: true as const } : {}),
    ...(visible ? { child: { select: { name: true as const } } } : {}),
    ...(visible
      ? {
          children: {
            select: { ...(visible ? { amount: true as const } : {}) },
          },
        }
      : {}),
  },
} satisfies ReadQuery<Resource>;
type ConditionalRow = ReadData<Resource, typeof conditional>["rows"][number];
type OptionalName = Expect<Equal<ConditionalRow["name"], string | undefined>>;
type OptionalChild = Expect<
  Equal<ConditionalRow["child"], { name: string } | null | undefined>
>;
type OptionalNestedAmount = Expect<
  Equal<
    NonNullable<ConditionalRow["children"]>[number]["amount"],
    number | null | undefined
  >
>;
declare const conditionalRow: ConditionalRow;
// @ts-expect-error Entirely conditional selections still exclude unselected fields.
conditionalRow.count;
// @ts-expect-error A selected nested value preserves its schema type.
const wrongNested: string = conditionalRow.children?.[0]?.amount;

type BroadRow = ReadData<Resource, ReadQuery<Resource>>["rows"][number];
type BroadName = Expect<Equal<BroadRow["name"], string | undefined>>;
type BroadNested = Expect<
  Equal<
    NonNullable<BroadRow["children"]>[number]["amount"],
    number | null | undefined
  >
>;

const union = visible
  ? { select: { name: true as const } }
  : { select: { count: true as const } };
type UnionRow = ReadData<Resource, typeof union>["rows"][number];
export function narrowSelection(row: UnionRow) {
  if ("name" in row) {
    const name: string = row.name;
    return name;
  }
  const count: number = row.count;
  return count;
}
declare const unionRow: UnionRow;
// @ts-expect-error A branch-dependent selection must be narrowed before reading name.
unionRow.name;

type LiteralRow = ReadData<
  Resource,
  { select: { name: true } }
>["rows"][number];
type LiteralName = Expect<Equal<LiteralRow["name"], string>>;
declare const literalRow: LiteralRow;
// @ts-expect-error Static queries continue to expose only their selected fields.
literalRow.count;
