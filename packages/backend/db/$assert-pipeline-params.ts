export function assertRecord(
  v?: unknown,
  field?: string
): asserts v is Record<string, any> | undefined {
  if (v === undefined) return;
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new Error(`Invalid '${field}': expected an object`);
}

export function assertArray<T>(v: unknown, checker: (item?: T) => boolean, field?: string): asserts v is T[] {
  if (!Array.isArray(v) || !v.every(checker))
    throw new Error(`Invalid '${field}': expected string[]`);
}

export function assertSortSpec(v?: unknown): asserts v is Record<string, -1 | 1> | undefined {
  if (v === undefined) return;
  assertRecord(v, "sort");
  for (const [k, val] of Object.entries(v)) {
    if (val !== 1 && val !== -1)
      throw new Error(`Invalid 'sort': key '${k}' must be 1 or -1`);
  }
}

export function assertPartitionSpec(v?: unknown): asserts v is {
  groupBy: string;
  orderBy: string;
  take: "first" | "last";
} | undefined {
  if (v === undefined) return;

  assertRecord(v, "partition");
  const { groupBy, orderBy, take } = v;
  if (
    typeof groupBy !== "string" ||
    typeof orderBy !== "string" ||
    (take !== "first" && take !== "last")
  )
    throw new Error(
      "Invalid 'partition': must have { groupBy: string, orderBy: string, take: 'first' | 'last' }"
    );
}


export interface AggregateField { alias: string, op: string; applyOnField: string }
export interface SimpleGroupBySpec {
  fields: string[];
  aggregations?: Array<AggregateField>
}

export function assertGroupBySpec(v?: SimpleGroupBySpec): asserts v is SimpleGroupBySpec {
  if (v === undefined) return;

  assertRecord(v, "groupBy");
  if (!Array.isArray(v.fields) || !v.fields.every((f) => typeof f === "string"))
    throw new Error("Invalid 'groupBy.fields': expected string[]");
  if (v.aggregations !== undefined)
    assertArray<AggregateField>(v.aggregations, (item) => typeof item?.alias === "string" && typeof item?.applyOnField === "string" && typeof item?.op === "string", 'groupBy.aggregations')

}

export function normalizeParams(params: {
  include?: any;
  select?: any;
  limit?: any;
  offset?: any;
  filters?: any;
  groupBy?: any;
  sort?: any;
  partition?: any;
}) {
  if (!params || typeof params !== "object")
    throw new Error("Invalid params: expected an object");

  const {
    include = [],
    select = [],
    limit = 20,
    offset = 0,
    filters,
    groupBy,
    sort,
    partition,
  } = params;

  // Validate arrays
  assertArray<string>(include, (item) => typeof item === "string", "include");
  assertArray<string>(select, (item) => typeof item === "string", "select");

  // Validate numbers
  if (typeof limit !== "number" || limit <= 0)
    throw new Error("Invalid 'limit': must be a positive number");
  if (typeof offset !== "number" || offset < 0)
    throw new Error("Invalid 'offset': must be a non-negative number");

  // Optional objects
  assertRecord(filters, "filters");
  assertGroupBySpec(groupBy);
  assertSortSpec(sort);
  assertPartitionSpec(partition);

  return {
    include,
    select,
    limit,
    offset,
    filters,
    groupBy,
    sort,
    partition,
  };
}
