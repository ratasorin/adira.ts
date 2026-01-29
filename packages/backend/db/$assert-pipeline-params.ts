import {
  AggregateOperation,
  ExecutorQueryParams,
  PickDistinctDefinition,
  RowIntent,
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
  v?: AggregateOperation<unknown, unknown>[],
): asserts v is AggregateOperation<unknown, unknown>[] {
  if (v === undefined) return;

  assertArray<AggregateOperation<unknown, unknown>>(v, (item) => {
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

const identity = <T>(t: T) => t;

export function normalizeParams(
  params: ExecutorQueryParams<
    any,
    any[],
    RowIntent<any[], any, any>,
    Record<string, any>
  >,
) {
  assertRecord(params, "params");

  // 1. Extract values from the new nested structure
  const include = params.include || [];
  const where = sanitizeFilters(params.where || {});

  // Handle the 'rows' identity function/object
  const rowData =
    typeof params.rows === "function"
      ? params.rows(identity)
      : ((params.rows || {}) as RowIntent<any[], any, any>);

  const select = rowData.select || [];
  const sortBy = rowData.sortBy;
  const pickDistinct = rowData.pickDistinct;
  const limit = rowData.limit ?? 50;
  const offset = rowData.offset ?? 0;

  // Handle the 'groups' identity function/object
  const groupsRaw =
    typeof params.groups === "function"
      ? params.groups(identity)
      : params.groups;

  // Validation
  assertArray<string>(include, (i) => typeof i === "string", "include");
  assertArray<string>(select, (i) => typeof i === "string", "select");
  assertSortBy(sortBy);

  return {
    include,
    where,
    select,
    sortBy,
    pickDistinct,
    limit,
    offset,
    groups: groupsRaw,
  };
}
