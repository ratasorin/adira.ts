import {
  AggregateOperation,
  ExecutorQueryParams,
  PickDistinctDefinition,
  SortByDefinition,
  WhereDefinition,
} from "@n/adira.core.ts";

export function assertRecord(
  v?: unknown,
  field?: string,
): asserts v is Record<string, any> | undefined {
  if (v === undefined) return;
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new Error(`Invalid '${field}': expected an object`);
}

export function assertArray<T>(
  v: unknown,
  checker: (item?: T) => boolean,
  field?: string,
): asserts v is T[] {
  if (!Array.isArray(v) || !v.every(checker))
    throw new Error(`Invalid '${field}': expected string[]`);
}

export function assertSortBy(
  v?: SortByDefinition<unknown>,
): asserts v is SortByDefinition<unknown> | undefined {
  if (v === undefined) return;
  assertRecord(v, "sortBy");
  for (const [k, val] of Object.entries(v)) {
    if (val !== 1 && val !== -1)
      throw new Error(`Invalid 'sortBy': key '${k}' must be 1 or -1`);
  }
}

export function assertPickDistinctSpec(
  v?: PickDistinctDefinition<unknown>,
): asserts v is PickDistinctDefinition<unknown> {
  if (v === undefined) return;

  assertRecord(v, "pickDistinct");
  const { by, keep, sortBy } = v;
  if (
    typeof by !== "string" ||
    typeof sortBy !== "string" ||
    (keep !== "first" && keep !== "last")
  )
    throw new Error(
      "Invalid 'pickDistinct': must have { by: string, keep: 'first' | 'last', sortBy: string }",
    );
}

export function assertAggregationSpec(
  v?: AggregateOperation<unknown>[],
): asserts v is AggregateOperation<unknown>[] {
  if (v === undefined) return;

  assertArray<AggregateOperation<unknown>>(v, (item) => {
    return (
      typeof item?.on === "string" &&
      typeof item?.fn === "string" &&
      typeof item?.as === "string"
    );
  });
}
/**
 * Detects ISO 8601 date strings and converts them to Date objects.
 */
function parseJsonValue(val: any): any {
  // 1. Handle Regex strings (your existing logic)
  if (
    typeof val === "string" &&
    val.startsWith("/") &&
    val.lastIndexOf("/") > 0
  ) {
    const lastSlash = val.lastIndexOf("/");
    const pattern = val.slice(1, lastSlash);
    const flags = val.slice(lastSlash + 1);
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      return val;
    }
  }

  // 2. Handle ISO Date strings
  // This regex matches: YYYY-MM-DDTHH:mm:ss.sssZ
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  if (typeof val === "string" && isoDateRegex.test(val)) {
    const date = new Date(val);
    // Ensure it's a valid date object
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return val;
}

/**
 * Recursively walks the filter object to sanitize regex and dates
 */
function sanitizeFilters(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  // Handle arrays (e.g., inside $in, $and, $or)
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFilters);
  }

  // If it's not an object (primitive), try to parse it
  if (typeof obj !== "object") {
    return parseJsonValue(obj);
  }

  const newObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Recurse into nested objects or arrays, then parse the leaves
    newObj[key] = sanitizeFilters(value);
  }
  return newObj;
}

export function normalizeParams(
  params: ExecutorQueryParams<
    any[],
    any[],
    any[],
    AggregateOperation<any>[],
    WhereDefinition<any>,
    SortByDefinition<any>,
    PickDistinctDefinition<any>
  >,
) {
  if (!params || typeof params !== "object")
    throw new Error("Invalid params: expected an object");

  let {
    include = [],
    select = [],
    limit = 20,
    offset = 0,
    where,
    groupBy,
    aggregates,
    sortBy,
    pickDistinct,
  } = params;

  // Validate arrays
  assertArray<string>(include, (item) => typeof item === "string", "include");
  assertArray<string>(select, (item) => typeof item === "string", "select");
  assertArray<string>(groupBy, (item) => typeof item === "string", "groupBy");

  // Validate numbers
  if (typeof limit !== "number" || limit <= 0)
    throw new Error("Invalid 'limit': must be a positive number");
  if (typeof offset !== "number" || offset < 0)
    throw new Error("Invalid 'offset': must be a non-negative number");

  // Optional objects
  assertRecord(where, "where");
  where = sanitizeFilters(where);
  assertAggregationSpec(aggregates);
  assertSortBy(sortBy);
  assertPickDistinctSpec(pickDistinct);

  return {
    include,
    select,
    limit,
    offset,
    where,
    aggregates,
    groupBy,
    sortBy,
    pickDistinct,
  };
}
