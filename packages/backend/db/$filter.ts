import { isObjectIdOrHexString, mongo } from "mongoose";

export function coerceObjectIdFilter<T>(filter: T): T {
  function recurse(obj: any): any {
    if (isObjectIdOrHexString(obj)) {
      return mongo.BSON.ObjectId.createFromHexString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(recurse);
    } else if (obj && typeof obj === "object") {
      const out: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        out[key] = recurse(val);
      }
      return out;
    }
    return obj;
  }
  return recurse(filter);
}

/**
 * Filters out all undefined values from a partial record.
 *
 * @param obj Partial record where values may be undefined
 * @returns Record with only defined values
 */
export function filterDefined<K extends string, V>(
  obj: Partial<Record<K, V | undefined>>
): Record<K, V> {
  const result = {} as Record<K, V>;
  for (const key in obj) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
