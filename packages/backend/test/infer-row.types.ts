import type { InferRow } from "@n/adira.core.ts";
import { getCategories } from "./fixtures";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
type Row = {
  readonly name: string;
  average: number | null;
  orders?: readonly { priority: number }[];
};
type Failure = { error: true; message: string };
declare function load(
  minimum: number,
): Promise<{ rows: readonly Row[]; total: number } | Failure>;
type FromLoader = Expect<Equal<InferRow<typeof load>, Row>>;
type FromPromise = Expect<Equal<InferRow<ReturnType<typeof load>>, Row>>;
type FromResult = Expect<
  Equal<InferRow<Awaited<ReturnType<typeof load>>>, Row>
>;
type FromSyncLoader = Expect<Equal<InferRow<() => { rows: Row[] }>, Row>>;
type FromTuple = Expect<
  Equal<
    InferRow<{ rows: readonly [Row, { id: string }] }>,
    Row | { id: string }
  >
>;
type FromUnion = Expect<
  Equal<
    InferRow<Promise<{ rows: Row[] } | { rows: { id: string }[] } | Failure>>,
    Row | { id: string }
  >
>;
type NullableElements = Expect<
  Equal<InferRow<{ rows: readonly (Row | null)[] }>, Row | null>
>;
type EmptyRows = Expect<Equal<InferRow<{ rows: readonly [] }>, never>>;
type NoRows = Expect<Equal<InferRow<() => Promise<void>>, never>>;

// Exercise an actual managed reader with a literal selection and nullable relation.
const loadNames = () =>
  getCategories({
    select: { name: true, createdBy: { select: { initials: true } } },
  });
type Selected = InferRow<typeof loadNames>;
type ExpectedName = Expect<Equal<Selected["name"], string>>;
type ExpectedChild = Expect<
  Equal<Selected["createdBy"], { readonly initials: string } | null>
>;
declare const selected: Selected;
// @ts-expect-error Extracting a row does not introduce unselected fields.
selected.slug;
// @ts-expect-error Extracting a row retains the scalar field's type.
const wrongName: number = selected.name;
// @ts-expect-error Nullable selected relations still require narrowing.
selected.createdBy.initials;
