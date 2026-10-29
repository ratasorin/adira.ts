/** A necessary Mongo match, never a replacement for the exact expression. */
export type IndexMatch = Readonly<Record<string, unknown>>;

export function andMatch(
  values: readonly (IndexMatch | undefined)[],
): IndexMatch | undefined {
  const known = values.filter(
    (value): value is IndexMatch => value !== undefined,
  );
  return known.length > 1 ? { $and: known } : known[0];
}

export function orMatch(
  values: readonly (IndexMatch | undefined)[],
): IndexMatch | undefined {
  if (!values.length || values.some((value) => value === undefined))
    return undefined;
  return values.length === 1 ? values[0] : { $or: values };
}

function indexLiteral(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return (
    !!value &&
    typeof value === "object" &&
    "_bsontype" in value &&
    value._bsontype === "ObjectId"
  );
}

/** Positive matches may admit arrays; the original scalar test rejects them. */
export function scalarMatch(
  field: string | undefined,
  operator: string,
  operand: unknown,
): IndexMatch | undefined {
  if (
    !field ||
    field.startsWith("$") ||
    field.includes(".") ||
    field.startsWith("__adira_") ||
    ["__proto__", "prototype", "constructor"].includes(field)
  )
    return undefined;
  if (operator === "$eq" && indexLiteral(operand)) {
    const match = { [field]: { $eq: operand } };
    // $ifNull also accepts legacy BSON undefined. Since MongoDB 8, ordinary
    // equality to null does not; include that type in the necessary filter.
    return operand === null
      ? { $or: [match, { [field]: { $type: "undefined" } }] }
      : match;
  }
  if (
    operator === "$in" &&
    Array.isArray(operand) &&
    operand.every(indexLiteral)
  ) {
    const match = { [field]: { $in: operand } };
    return operand.includes(null)
      ? { $or: [match, { [field]: { $type: "undefined" } }] }
      : match;
  }
  if (
    ["$gt", "$gte", "$lt", "$lte"].includes(operator) &&
    typeof operand === "number" &&
    Number.isFinite(operand)
  )
    return { [field]: { [operator]: operand } };
  // Negating a necessary match would exclude valid array-valued inputs.
  return undefined;
}
