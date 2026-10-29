import {
  FieldValue,
  FilterDefinitions,
  FilterKeys,
  OperatorValue,
  OperatorsOf,
  RelationField,
  ResourceLike,
  SortableKeys,
} from "./resource";
import { ReadValidationError, readRecord } from "./schema";

type NonEmpty<T> = readonly [T, ...T[]];
export type ReadWhere<R extends ResourceLike> = {
  [K in FilterKeys<R>]?: {
    [Op in OperatorsOf<FilterDefinitions<R>[K]>]?: OperatorValue<
      FilterDefinitions<R>[K],
      Op
    >;
  };
} & {
  $and?: NonEmpty<ReadWhere<R>>;
  $or?: NonEmpty<ReadWhere<R>>;
  $not?: ReadWhere<R>;
};

export type ReadSelection<R extends ResourceLike> = {
  [K in keyof R["fields"]]?: R["fields"][K] extends RelationField<
    infer Child,
    infer Many,
    boolean
  >
    ? Many extends true
      ? ReadQuery<Child>
      : Pick<ReadQuery<Child>, "select" | "where">
    : true;
};
export interface ReadPage {
  limit?: number;
  offset?: number;
}
export type ReadQuery<R extends ResourceLike> = {
  select: ReadSelection<R>;
  where?: ReadWhere<R>;
  orderBy?: Partial<Record<SortableKeys<R>, "asc" | "desc">>;
  page?: ReadPage;
};

/** Build an optional query part only when enabled, preserving its literal type. */
export function when<const T>(
  condition: boolean,
  create: () => T,
): T | undefined {
  return condition ? create() : undefined;
}

type ExactWhereList<R extends ResourceLike, List extends readonly unknown[]> = {
  [I in keyof List]: ExactWhere<R, List[I]>;
};
type ExactBooleanList<
  R extends ResourceLike,
  Value,
> = Value extends readonly unknown[]
  ? ExactWhereList<R, Value>
  : Value extends undefined
    ? undefined
    : never;
type ExactOperators<Field, Value> = Value extends object
  ? { [Op in keyof Value]: Op extends OperatorsOf<Field> ? Value[Op] : never }
  : Value;
type ExactWhere<R extends ResourceLike, W> = W extends object
  ? {
      [K in keyof W]: K extends "$and" | "$or"
        ? ExactBooleanList<R, W[K]>
        : K extends "$not"
          ? ExactWhere<R, W[K]>
          : K extends FilterKeys<R>
            ? ExactOperators<FilterDefinitions<R>[K], W[K]>
            : never;
    }
  : W;
type ExactChild<
  R extends ResourceLike,
  Value,
  Many extends boolean,
> = Value extends object
  ? ExactReadQuery<R, Value> &
      (Many extends true
        ? unknown
        : { [P in Exclude<keyof Value, "select" | "where">]: never })
  : Value extends undefined
    ? undefined
    : never;
type ExactSelection<R extends ResourceLike, S> = {
  [K in keyof S]: K extends keyof R["fields"]
    ? R["fields"][K] extends RelationField<infer Child, infer Many, boolean>
      ? ExactChild<Child, S[K], Many>
      : ExactFlag<S[K]>
    : never;
};
type ExactFlag<Value> = Value extends true | undefined ? Value : never;
type ExactOrderBy<R extends ResourceLike, Value> = Value extends object
  ? { [F in keyof Value]: F extends SortableKeys<R> ? Value[F] : never }
  : Value extends undefined
    ? undefined
    : never;
type ExactPage<Value> = Value extends object
  ? { [P in keyof Value]: P extends keyof ReadPage ? Value[P] : never }
  : Value extends undefined
    ? undefined
    : never;
export type ExactReadQuery<R extends ResourceLike, Q> = {
  [K in keyof Q]: K extends "select"
    ? ExactSelection<R, Q[K]>
    : K extends "where"
      ? ExactWhere<R, Q[K]>
      : K extends "orderBy"
        ? ExactOrderBy<R, Q[K]>
        : K extends "page"
          ? ExactPage<Q[K]>
          : never;
};

type UndefinedKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never;
}[keyof T];
type OptionalKeys<T, Keys extends PropertyKey> = {
  [K in keyof (Omit<T, Keys> &
    Partial<Pick<T, Extract<keyof T, Keys>>>)]: (Omit<T, Keys> &
    Partial<Pick<T, Extract<keyof T, Keys>>>)[K];
};

type SelectedField<F, S> =
  F extends RelationField<infer Child, infer Many, infer Nullable>
    ? S extends { select: infer ChildSelection }
      ?
          | (Many extends true
              ? SelectedResource<Child, ChildSelection>[]
              : SelectedResource<Child, ChildSelection>)
          | (Nullable extends true ? null : never)
      : never
    : FieldValue<F>;
type SelectedFields<R extends ResourceLike, S> = {
  [K in keyof S as K extends keyof R["fields"]
    ? Exclude<S[K], undefined> extends never
      ? never
      : K
    : never]: SelectedField<R["fields"][K & keyof R["fields"]], S[K]>;
};
export type SelectedResource<R extends ResourceLike, S> = S extends unknown
  ? OptionalKeys<SelectedFields<R, S>, UndefinedKeys<S>>
  : never;

type NormalizedSelectionValue<Value> = Value extends true
  ? true
  : Value extends { select: object }
    ? NormalizedReadQuery<Value>
    : never;
type NormalizedSelection<S> = S extends unknown
  ? OptionalKeys<
      {
        [K in keyof S as Exclude<S[K], undefined> extends never
          ? never
          : K]: NormalizedSelectionValue<S[K]>;
      },
      UndefinedKeys<S>
    >
  : never;
/** Canonical query literals omit undefined selections and optional query parts. */
export type NormalizedReadQuery<Q> = Q extends { select: infer Selection }
  ? {
      [K in keyof Pick<Q, "select">]: NormalizedSelection<Selection>;
    } & OptionalKeys<
      {
        [K in keyof Q as K extends "select"
          ? never
          : Exclude<Q[K], undefined> extends never
            ? never
            : K]: Exclude<Q[K], undefined>;
      },
      UndefinedKeys<Q>
    >
  : never;

export type ReadData<R extends ResourceLike, Q> = {
  // Conditional selections retain optional fields; widening keeps the resource schema.
  rows: Q extends { select: infer S } ? SelectedResource<R, S>[] : unknown[];
};

type RowFromResult<Result> = Result extends { rows: readonly unknown[] }
  ? Result["rows"][number]
  : never;

/** Infer a row from a loader, promised result, or result; omit branches without rows. */
export type InferRow<Source> = Source extends (...args: never[]) => infer Result
  ? RowFromResult<Awaited<Result>>
  : RowFromResult<Awaited<Source>>;

declare const executedReadBrand: unique symbol;
export type ExecutedRead<R extends ResourceLike, Q = ReadQuery<R>> = ReadData<
  R,
  Q
> & { readonly [executedReadBrand]: R };
export type ReadPlanInspection = {
  pipeline: readonly unknown[];
  application: readonly string[];
  nativePagination: boolean;
  deferredRelations: readonly string[];
  /** All strategies establish parent association before child transformations. */
  relationStrategies: Readonly<
    Record<string, "lookup" | "batched-lookup" | "resolveBatch">
  >;
  relations: Readonly<Record<string, ReadPlanInspection>>;
  /** Compatible bulk reductions share one validated aggregation per parent key batch. */
  reductionGroups?: readonly {
    loads: readonly string[];
    phase: "membership" | "output";
    pipeline: readonly unknown[];
  }[];
  dependencies: Readonly<
    Record<
      string,
      {
        operation: string;
        strategy: "mongodb" | "application";
        /** Bulk plans fall back per batch for non-ObjectId or multikey parents. */
        execution?: "bulk" | "parent-scoped";
        reason?: string;
        fusedWith?: readonly string[];
        fusionReason?: string;
        pipeline: readonly unknown[];
        child: ReadPlanInspection;
      }
    >
  >;
};
/** Context-free readers allow omission; concrete context requirements do not. */
export type ReadContextArguments<Context> = undefined extends Context
  ? [context?: Context]
  : [context: Context];

export interface ReadExecutor<R extends ResourceLike, Context = unknown> {
  <const Q extends ReadQuery<R>>(
    query: Q & ExactReadQuery<R, Q>,
    ...context: ReadContextArguments<Context>
  ): Promise<ExecutedRead<R, Q>>;
  readonly __resource: R;
  inspect(
    query: ReadQuery<R>,
    ...context: ReadContextArguments<Context>
  ): ReadPlanInspection;
}
export type ResourceOfResponse<Response> = Response extends {
  rows: readonly unknown[];
}
  ? "__resource" extends keyof Response
    ? Response extends { __resource?: infer R extends ResourceLike }
      ? R
      : never
    : never
  : never;
export type ReadResponse<
  R extends ResourceLike,
  Q,
  Extra = undefined,
> = ReadData<R, Q> & ([Extra] extends [undefined] ? {} : { related?: Extra });

export type WhereNode =
  | { kind: "atom"; field: string; operator: string; value: unknown }
  | { kind: "and" | "or"; children: WhereNode[] }
  | { kind: "not"; child: WhereNode };
export interface ParsedReadQuery {
  select: Readonly<Record<string, true | ParsedReadQuery>>;
  where: WhereNode;
  orderBy: Record<string, 1 | -1>;
  limit: number;
  offset: number;
  /** Internal to-one probe: two rows detect a cardinality violation. */
  one: boolean;
}
export interface ReadLimits {
  defaultLimit: number;
  maxLimit: number;
  maxDepth: number;
  maxNodes: number;
  maxOperandItems: number;
  maxQueryBytes: number;
  maxCandidates: number;
}
export const defaultReadLimits: Readonly<ReadLimits> = Object.freeze({
  defaultLimit: 50,
  maxLimit: 200,
  maxDepth: 12,
  maxNodes: 200,
  maxOperandItems: 200,
  maxQueryBytes: 64_000,
  maxCandidates: 10_000,
});

function onlyKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(input))
    if (!allowed.includes(key))
      throw new ReadValidationError(`${path}: unsupported key '${key}'`);
}

/** Parse the complete query before constructing providers or touching a database. */
export function parseReadQuery(
  resource: ResourceLike,
  raw: unknown,
  limits: ReadLimits = { ...defaultReadLimits },
  paginationFor?: (
    path: readonly string[],
  ) => Pick<ReadLimits, "defaultLimit" | "maxLimit">,
  internal: { allowEmptyRootSelection?: boolean } = {},
): ParsedReadQuery {
  let input = readRecord(raw, "query");
  const byteLength = (value: string) =>
    new TextEncoder().encode(value).byteLength;
  if (Object.keys(input).length === 1 && typeof input.query === "string") {
    if (byteLength(input.query) > limits.maxQueryBytes)
      throw new ReadValidationError("Query is too large");
    try {
      input = readRecord(JSON.parse(input.query), "query");
    } catch (error) {
      throw new ReadValidationError(
        `Invalid JSON query: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    throw new ReadValidationError("Query must be JSON serializable");
  }
  if (byteLength(serialized) > limits.maxQueryBytes)
    throw new ReadValidationError("Query is too large");
  let nodes = 0;
  function visit(depth: number): void {
    if (depth > limits.maxDepth)
      throw new ReadValidationError("Query exceeds maximum depth");
    if (++nodes > limits.maxNodes)
      throw new ReadValidationError("Query exceeds maximum node count");
  }
  function where(r: ResourceLike, value: unknown, depth: number): WhereNode {
    visit(depth);
    const object = readRecord(value, "where");
    const children: WhereNode[] = [];
    for (const [key, operand] of Object.entries(object)) {
      if (key === "$and" || key === "$or") {
        if (!Array.isArray(operand) || !operand.length)
          throw new ReadValidationError(`${key}: expected a non-empty array`);
        children.push({
          kind: key === "$and" ? "and" : "or",
          children: operand.map((item) => where(r, item, depth + 1)),
        });
      } else if (key === "$not") {
        children.push({ kind: "not", child: where(r, operand, depth + 1) });
      } else {
        const definition = Object.prototype.hasOwnProperty.call(
          r.predicates,
          key,
        )
          ? r.predicates[key]
          : Object.prototype.hasOwnProperty.call(r.fields, key)
            ? r.fields[key]
            : undefined;
        if (
          !definition ||
          definition.kind !== "scalar" ||
          !definition.operators.length
        )
          throw new ReadValidationError(`Field '${key}' is not filterable`);
        const operations = readRecord(operand, `where.${key}`);
        if (!Object.keys(operations).length)
          throw new ReadValidationError(`where.${key}: expected an operator`);
        for (const [operator, argument] of Object.entries(operations)) {
          visit(depth + 1);
          if (!definition.operators.includes(operator as never))
            throw new ReadValidationError(
              `Operator '${operator}' is not allowed on '${key}'`,
            );
          let parsed: unknown;
          if (operator === "$in" || operator === "$nin") {
            if (
              !Array.isArray(argument) ||
              argument.length > limits.maxOperandItems
            )
              throw new ReadValidationError(
                `${operator}: expected an array of at most ${limits.maxOperandItems} values`,
              );
            parsed = argument.map((item) => definition.value.parse(item));
          } else if (operator === "$startsWith" || operator === "$contains") {
            if (typeof argument !== "string")
              throw new ReadValidationError(`${operator}: expected a string`);
            parsed = argument;
          } else {
            parsed = definition.value.parse(argument);
            if (
              parsed === null &&
              ["$gt", "$gte", "$lt", "$lte"].includes(operator)
            )
              throw new ReadValidationError(
                `${operator}: null is not a comparison operand`,
              );
          }
          children.push({ kind: "atom", field: key, operator, value: parsed });
        }
      }
    }
    return { kind: "and", children };
  }
  function query(
    r: ResourceLike,
    value: unknown,
    depth: number,
    one = false,
    path: readonly string[] = [],
  ): ParsedReadQuery {
    visit(depth);
    const object = readRecord(value, "query");
    onlyKeys(
      object,
      one ? ["select", "where"] : ["select", "where", "orderBy", "page"],
      "query",
    );
    const selection = readRecord(object.select, "select");
    const select: Record<string, true | ParsedReadQuery> = {};
    for (const [key, selected] of Object.entries(selection)) {
      visit(depth + 1);
      const definition = Object.prototype.hasOwnProperty.call(r.fields, key)
        ? r.fields[key]
        : undefined;
      if (!definition)
        throw new ReadValidationError(`Unknown selected field '${key}'`);
      if (selected === undefined) continue;
      if (definition.kind === "relation")
        select[key] = query(
          definition.resource,
          selected,
          depth + 1,
          !definition.many,
          [...path, key],
        );
      else {
        if (selected !== true)
          throw new ReadValidationError(`select.${key}: expected true`);
        select[key] = true;
      }
    }
    if (
      !Object.keys(select).length &&
      !(depth === 0 && internal.allowEmptyRootSelection)
    )
      throw new ReadValidationError("select: choose at least one field");
    const orderBy: Record<string, 1 | -1> = {};
    if (object.orderBy !== undefined)
      for (const [key, direction] of Object.entries(
        readRecord(object.orderBy, "orderBy"),
      )) {
        const definition = Object.prototype.hasOwnProperty.call(r.fields, key)
          ? r.fields[key]
          : undefined;
        if (!definition || definition.kind !== "scalar" || !definition.sortable)
          throw new ReadValidationError(`Field '${key}' is not sortable`);
        if (direction !== "asc" && direction !== "desc")
          throw new ReadValidationError(`orderBy.${key}: expected asc or desc`);
        orderBy[key] = direction === "asc" ? 1 : -1;
      }
    const page =
      object.page === undefined ? {} : readRecord(object.page, "page");
    onlyKeys(page, ["limit", "offset"], "page");
    const pagination = paginationFor?.(path) ?? limits;
    const maximum = one ? 2 : Math.min(limits.maxLimit, pagination.maxLimit);
    const limit = one
      ? 2
      : (page.limit ?? Math.min(pagination.defaultLimit, maximum));
    const offset = page.offset ?? 0;
    if (
      typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > maximum
    )
      throw new ReadValidationError(
        `page.limit: expected an integer from 1 to ${maximum}`,
      );
    if (
      typeof offset !== "number" ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new ReadValidationError(
        "page.offset: expected a non-negative safe integer",
      );
    return {
      select,
      where: where(r, object.where ?? {}, depth + 1),
      orderBy,
      limit,
      offset,
      one,
    };
  }
  return query(resource, input, 0);
}

/** Validate before omitting undefined parts; filter operands are kept intact. */
export function normalizeReadQuery<
  R extends ResourceLike,
  const Q extends ReadQuery<R>,
>(
  resource: R,
  query: Q & ExactReadQuery<R, Q>,
  limits?: ReadLimits,
): NormalizedReadQuery<Q>;
export function normalizeReadQuery(
  resource: ResourceLike,
  input: unknown,
  limits?: ReadLimits,
): object {
  parseReadQuery(resource, input, limits);
  function normalize(value: unknown): Record<string, unknown> {
    const query = readRecord(value, "query");
    const result: Record<string, unknown> = {};
    for (const [key, part] of Object.entries(query)) {
      if (part === undefined) continue;
      if (key === "select") {
        result.select = Object.fromEntries(
          Object.entries(readRecord(part, "select"))
            .filter(([, selected]) => selected !== undefined)
            .map(([field, selected]) => [
              field,
              selected === true ? true : normalize(selected),
            ]),
        );
      } else result[key] = part;
    }
    return result;
  }
  return normalize(input);
}
