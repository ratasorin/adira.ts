import { schema, ValueSchema } from "@n/adira.core.ts";
import { andMatch, IndexMatch, orMatch, scalarMatch } from "./index-match";

export type DataRow = Record<string, unknown>;
export type MaybePromise<T> = T | Promise<T>;

/** Native representation and a reference evaluator for application-side composition. */
export class MongoExpression<T> {
  declare readonly __value: T;
  constructor(
    readonly native: unknown,
    readonly dependencies: ReadonlySet<string>,
    readonly evaluate: (row: DataRow) => T,
    readonly output?: ValueSchema<T>,
    /** False when JavaScript and MongoDB conversions need not have identical semantics. */
    readonly applicationSafe = true,
    /** Compiler facts supplied by built-ins; raw expressions need no metadata. */
    readonly optimization?: {
      readonly field?: string;
      readonly match?: IndexMatch;
    },
  ) {}
}

const dependencies = (
  ...expressions: MongoExpression<unknown>[]
): ReadonlySet<string> =>
  new Set(expressions.flatMap((expression) => [...expression.dependencies]));

function numeric(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error("Numeric expression received a non-number");
  return value;
}

function equalValues(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left instanceof Date || right instanceof Date)
    return (
      left instanceof Date &&
      right instanceof Date &&
      left.getTime() === right.getTime()
    );
  if (!left || !right || typeof left !== "object" || typeof right !== "object")
    return false;
  if ("toHexString" in left && typeof left.toHexString === "function") {
    return (
      "toHexString" in right &&
      typeof right.toHexString === "function" &&
      left.toHexString() === right.toHexString()
    );
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => equalValues(value, right[index]))
    );
  }
  const keys = Object.keys(left),
    other = Object.keys(right);
  return (
    keys.length === other.length &&
    keys.every(
      (key, index) =>
        key === other[index] &&
        equalValues((left as DataRow)[key], (right as DataRow)[key]),
    )
  );
}

export class Expressions<Row extends object> {
  field<Key extends keyof Row & string>(key: Key): MongoExpression<Row[Key]> {
    return new MongoExpression(
      `$${key}`,
      new Set([key]),
      (row) => row[key] as Row[Key],
      undefined,
      true,
      { field: key },
    );
  }

  literal<T>(value: T): MongoExpression<T> {
    return new MongoExpression({ $literal: value }, new Set(), () => value);
  }

  add(
    left: MongoExpression<number>,
    right: MongoExpression<number>,
  ): MongoExpression<number> {
    return new MongoExpression(
      { $add: [left.native, right.native] },
      dependencies(left, right),
      (row) => numeric(left.evaluate(row)) + numeric(right.evaluate(row)),
      schema.number(),
      left.applicationSafe && right.applicationSafe,
    );
  }

  multiply(
    left: MongoExpression<number>,
    right: MongoExpression<number>,
  ): MongoExpression<number> {
    return new MongoExpression(
      { $multiply: [left.native, right.native] },
      dependencies(left, right),
      (row) => numeric(left.evaluate(row)) * numeric(right.evaluate(row)),
      schema.number(),
      left.applicationSafe && right.applicationSafe,
    );
  }

  lower(value: MongoExpression<string>): MongoExpression<string> {
    return new MongoExpression(
      { $toLower: value.native },
      value.dependencies,
      (row) => schema.string().parse(value.evaluate(row)).toLowerCase(),
      schema.string(),
      false,
    );
  }

  upper(value: MongoExpression<string>): MongoExpression<string> {
    return new MongoExpression(
      { $toUpper: value.native },
      value.dependencies,
      (row) => schema.string().parse(value.evaluate(row)).toUpperCase(),
      schema.string(),
      false,
    );
  }

  toString(value: MongoExpression<unknown>): MongoExpression<string> {
    return new MongoExpression(
      { $toString: value.native },
      value.dependencies,
      (row) => {
        const resolved = value.evaluate(row);
        if (resolved === null || resolved === undefined)
          throw new Error("Cannot stringify a missing value");
        return String(resolved);
      },
      schema.string(),
      false,
    );
  }

  size(value: MongoExpression<readonly unknown[]>): MongoExpression<number> {
    return new MongoExpression(
      { $size: value.native },
      value.dependencies,
      (row) => {
        const resolved = value.evaluate(row);
        if (!Array.isArray(resolved))
          throw new Error("size() received a non-array");
        return resolved.length;
      },
      schema.number(),
      value.applicationSafe,
    );
  }

  eq<T>(
    left: MongoExpression<T>,
    right: Exclude<NoInfer<T>, undefined>,
  ): MongoExpression<boolean> {
    return new MongoExpression(
      { $eq: [{ $ifNull: [left.native, null] }, { $literal: right }] },
      left.dependencies,
      (row) => equalValues(left.evaluate(row) ?? null, right),
      schema.boolean(),
      left.applicationSafe,
      { match: scalarMatch(left.optimization?.field, "$eq", right) },
    );
  }

  gt(left: MongoExpression<number>, right: number): MongoExpression<boolean> {
    return new MongoExpression(
      {
        $and: [
          { $isNumber: left.native },
          { $gt: [left.native, { $literal: right }] },
        ],
      },
      left.dependencies,
      (row) =>
        typeof left.evaluate(row) === "number" &&
        numeric(left.evaluate(row)) > right,
      schema.boolean(),
      left.applicationSafe,
      { match: scalarMatch(left.optimization?.field, "$gt", right) },
    );
  }

  gte(left: MongoExpression<number>, right: number): MongoExpression<boolean> {
    return new MongoExpression(
      {
        $and: [
          { $isNumber: left.native },
          { $gte: [left.native, { $literal: right }] },
        ],
      },
      left.dependencies,
      (row) =>
        typeof left.evaluate(row) === "number" &&
        numeric(left.evaluate(row)) >= right,
      schema.boolean(),
      left.applicationSafe,
      { match: scalarMatch(left.optimization?.field, "$gte", right) },
    );
  }

  startsWith(
    left: MongoExpression<string>,
    prefix: string,
  ): MongoExpression<boolean> {
    return new MongoExpression(
      {
        $cond: [
          { $eq: [{ $type: left.native }, "string"] },
          { $eq: [{ $indexOfCP: [left.native, { $literal: prefix }] }, 0] },
          false,
        ],
      },
      left.dependencies,
      (row) =>
        typeof left.evaluate(row) === "string" &&
        left.evaluate(row).startsWith(prefix),
      schema.boolean(),
      left.applicationSafe,
    );
  }

  isNull(value: MongoExpression<unknown>): MongoExpression<boolean> {
    return new MongoExpression(
      { $eq: [{ $ifNull: [value.native, null] }, null] },
      value.dependencies,
      (row) => value.evaluate(row) == null,
      schema.boolean(),
      value.applicationSafe,
      { match: scalarMatch(value.optimization?.field, "$eq", null) },
    );
  }

  and(...values: MongoExpression<boolean>[]): MongoExpression<boolean> {
    return new MongoExpression(
      { $and: values.map((value) => value.native) },
      dependencies(...values),
      (row) => values.every((value) => value.evaluate(row)),
      schema.boolean(),
      values.every((value) => value.applicationSafe),
      { match: andMatch(values.map((value) => value.optimization?.match)) },
    );
  }

  or(...values: MongoExpression<boolean>[]): MongoExpression<boolean> {
    return new MongoExpression(
      { $or: values.map((value) => value.native) },
      dependencies(...values),
      (row) => values.some((value) => value.evaluate(row)),
      schema.boolean(),
      values.every((value) => value.applicationSafe),
      { match: orMatch(values.map((value) => value.optimization?.match)) },
    );
  }

  not(value: MongoExpression<boolean>): MongoExpression<boolean> {
    return new MongoExpression(
      { $not: [value.native] },
      value.dependencies,
      (row) => !value.evaluate(row),
      schema.boolean(),
      value.applicationSafe,
    );
  }
}

/** Built-in scalar predicates have explicitly two-valued null/missing semantics. */
export function scalarExpression(
  field: string,
  operator: string,
  operand: unknown,
): MongoExpression<boolean> {
  const property = `$${field}`;
  const value = { $ifNull: [property, null] };
  let native: unknown;
  const equal = { $eq: [value, { $literal: operand }] };
  switch (operator) {
    case "$eq":
      native = equal;
      break;
    case "$ne":
      native = { $not: [equal] };
      break;
    case "$in":
      native = { $in: [value, { $literal: operand }] };
      break;
    case "$nin":
      native = { $not: [{ $in: [value, { $literal: operand }] }] };
      break;
    case "$gt":
    case "$gte":
    case "$lt":
    case "$lte":
      native = {
        $and: [
          { $isNumber: property },
          { [operator]: [property, { $literal: operand }] },
        ],
      };
      break;
    case "$startsWith":
    case "$contains":
      native = {
        $cond: [
          { $eq: [{ $type: property }, "string"] },
          {
            [operator === "$startsWith" ? "$eq" : "$gte"]: [
              { $indexOfCP: [property, { $literal: operand }] },
              0,
            ],
          },
          false,
        ],
      };
      break;
    default:
      throw new Error(`Unsupported scalar operator '${operator}'`);
  }
  return new MongoExpression(
    native,
    new Set([field]),
    (row) => {
      const resolved = row[field] ?? null;
      switch (operator) {
        case "$eq":
          return resolved === operand;
        case "$ne":
          return resolved !== operand;
        case "$in":
          return (operand as unknown[]).includes(resolved);
        case "$nin":
          return !(operand as unknown[]).includes(resolved);
        case "$gt":
          return typeof resolved === "number" && resolved > (operand as number);
        case "$gte":
          return (
            typeof resolved === "number" && resolved >= (operand as number)
          );
        case "$lt":
          return typeof resolved === "number" && resolved < (operand as number);
        case "$lte":
          return (
            typeof resolved === "number" && resolved <= (operand as number)
          );
        case "$startsWith":
          return (
            typeof resolved === "string" &&
            resolved.startsWith(operand as string)
          );
        case "$contains":
          return (
            typeof resolved === "string" && resolved.includes(operand as string)
          );
        default:
          return false;
      }
    },
    schema.boolean(),
    true,
    { match: scalarMatch(field, operator, operand) },
  );
}
