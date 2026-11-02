import {
  defineResource,
  field,
  normalizeReadQuery,
  when,
  type InferRow,
  type NormalizedReadQuery,
  type ReadData,
  type ReadQuery,
} from "@n/adira.core.ts";
import { getCategories, relations } from "./fixtures";

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
  count: field.number().orderable(),
  child: field.one(Child).nullable(),
  children: field.many(Child),
});
type Resource = typeof Parent;
declare const enabled: boolean;
declare const direction: "asc" | "desc" | undefined;

const query = normalizeReadQuery(Parent, {
  select: {
    name: true,
    count: when(enabled, () => true),
    child: when(enabled, () => ({ select: { name: true } })),
    children: when(enabled, () => ({
      select: { name: true, amount: when(enabled, () => true) },
      page: when(enabled, () => ({ limit: 5, offset: 0 })),
    })),
  },
  orderBy: direction ? { count: direction } : undefined,
  page: when(enabled, () => ({ limit: 5 })),
});
type Row = ReadData<Resource, typeof query>["rows"][number];
type RequiredName = Expect<Equal<Row["name"], string>>;
type OptionalCount = Expect<Equal<Row["count"], number | undefined>>;
type OptionalCountKey = Expect<
  Equal<{} extends Pick<Row, "count"> ? true : false, true>
>;
type OptionalOne = Expect<
  Equal<Row["child"], { readonly name: string } | null | undefined>
>;
type NestedRequiredName = Expect<
  Equal<NonNullable<Row["children"]>[number]["name"], string>
>;
type NestedOptionalAmount = Expect<
  Equal<
    NonNullable<Row["children"]>[number]["amount"],
    number | null | undefined
  >
>;

type RawRow = ReadData<
  Resource,
  { select: { name: true; count: true | undefined; child: undefined } }
>["rows"][number];
type RawRequiredName = Expect<Equal<RawRow["name"], string>>;
type RawOptionalCount = Expect<Equal<RawRow["count"], number | undefined>>;
type RawKeys = Expect<Equal<keyof RawRow, "name" | "count">>;
type Normalized = NormalizedReadQuery<{
  readonly select: { readonly name: true; readonly count: undefined };
  where: undefined;
  page: { limit: 5 } | undefined;
}>;
type OmittedParts = Expect<Equal<keyof Normalized, "select" | "page">>;
type OmittedSelection = Expect<Equal<keyof Normalized["select"], "name">>;
type OptionalPage = Expect<Equal<Normalized["page"], { limit: 5 } | undefined>>;

const selectionUnion = normalizeReadQuery(Parent, {
  select: enabled ? { name: true } : { count: true },
});
type SelectionUnionRow = ReadData<
  Resource,
  typeof selectionUnion
>["rows"][number];
export function narrowSelectionUnion(row: SelectionUnionRow) {
  if ("name" in row) {
    const value: string = row.name;
    return value;
  }
  const value: number = row.count;
  return value;
}

// A generic consumer can still rely on the required selection property.
function selection<R extends Resource, Q extends ReadQuery<R>>(
  value: NormalizedReadQuery<Q>,
): object {
  return value.select;
}

const load = () =>
  getCategories({
    select: {
      name: true,
      displayName: when(enabled, () => true),
      createdBy: when(enabled, () => ({ select: { initials: true } })),
      products: when(enabled, () => ({ select: { stock: true } })),
    },
    orderBy: direction ? { id: direction } : undefined,
    page: when(enabled, () => ({ limit: 5 })),
  });
type BackendRow = InferRow<typeof load>;
type BackendRequiredName = Expect<Equal<BackendRow["name"], string>>;
type BackendOptionalName = Expect<
  Equal<BackendRow["displayName"], string | undefined>
>;
type BackendOptionalChild = Expect<
  Equal<
    BackendRow["createdBy"],
    { readonly initials: string } | null | undefined
  >
>;
type BackendNested = Expect<
  Equal<NonNullable<BackendRow["products"]>[number]["stock"], number>
>;

// Complete relation dependencies accept conditional selections as well.
relations.products.all({
  select: { name: true, stock: when(enabled, () => true) },
});

export function rejectedConditionalQueries(row: Row, raw: RawRow) {
  // @ts-expect-error Conditional fields require an absence check.
  row.count.toFixed();
  // @ts-expect-error Nullable conditional relations require narrowing.
  row.child.name;
  // @ts-expect-error Unselected nested fields remain unavailable.
  row.children?.[0]?.id;
  // @ts-expect-error An always-undefined selection is omitted from the row type.
  raw.child;
  // @ts-expect-error Normalization preserves readonly selection flags.
  query.select.name = true;
  // @ts-expect-error Normalization preserves the readonly selection property.
  query.select = { name: true };
  normalizeReadQuery(Parent, {
    select: {
      name: true,
      // @ts-expect-error Unknown keys stay invalid even when undefined.
      unsupported: undefined,
    },
  });
  normalizeReadQuery(Parent, {
    select: {
      name: true,
      // @ts-expect-error Scalar conditional selections must produce true.
      count: when(enabled, () => "yes"),
    },
  });
  normalizeReadQuery(Parent, {
    select: {
      name: true,
      // @ts-expect-error Nested exact checking applies through conditional helpers.
      children: when(enabled, () => ({
        select: { name: true, missing: true },
      })),
    },
  });
  normalizeReadQuery(Parent, {
    select: { name: true },
    // @ts-expect-error Optional sorting still rejects unknown keys.
    orderBy: when(enabled, () => ({ name: "asc" })),
  });
  normalizeReadQuery(Parent, {
    select: { name: true },
    // @ts-expect-error Optional pages still reject unsupported keys.
    page: when(enabled, () => ({ limit: 5, cursor: "next" })),
  });
  normalizeReadQuery(Parent, {
    select: {
      name: true,
      // @ts-expect-error Optional single-record includes still forbid pagination.
      child: when(enabled, () => ({
        select: { name: true },
        page: { limit: 1 },
      })),
    },
  });
}
