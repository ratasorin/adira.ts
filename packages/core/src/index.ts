export type RefTo<T> = { __refTo?: T };

export type CleanRef<T> = {
  [K in keyof T]: T[K] extends RefTo<any> ? string : T[K];
};

export type Keys<T> = keyof T;

export type Scalar =
  | Serialize<unknown, unknown>
  | RefTo<unknown>
  | Function
  | Date
  | RegExp
  | bigint
  | symbol
  | string
  | number
  | boolean
  | null
  | undefined
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>
  | Promise<any>
  | Error;

export type IsScalar<T> = T extends Scalar ? true : false;
export type IsRefTo<T> = T extends { __refTo?: any } ? true : false;

export type Join<
  Prefix extends string = "",
  Key extends string = "",
> = Prefix extends "" ? Key : `${Prefix}.${Key}`;

export type Element<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Checks if a type is exactly mongoose.Types.ObjectId
 *
 * @template T - The type to check
 * @returns true if T is ObjectId, false otherwise
 *
 * @example
 * ```ts
 * type A = IsObjectId<mongoose.Types.ObjectId>; // true
 * type B = IsObjectId<string>; // false
 * ```
 */
export type IsReference<T> = T extends RefTo<unknown> ? true : false;

export type PopulatableKeys<
  T = {},
  Prefix extends string = "",
  Depth extends number = 10,
> = [Depth] extends [0]
  ? never
  : IsReference<T> extends true
    ? Prefix
    : T extends Scalar
      ? never
      : T extends readonly any[]
        ? PopulatableKeys<Element<T>, Prefix, Prev[Depth]>
        : T extends object
          ? KeyIteration<T, Prefix, Depth>
          : never;

export type KeyIteration<
  T = {},
  Prefix extends string = "",
  Depth extends number = 10,
> =
  Keys<T> extends infer K
    ? K extends keyof T
      ? K extends "_id" // skip root _id
        ? never
        : PopulatableKeys<T[K], Join<Prefix, K & string>, Prev[Depth]>
      : never
    : never;

export type KeysWithPrefix<
  R = {},
  Prefix extends string = "",
> = keyof R extends infer K
  ? K extends string
    ? K extends `${Prefix}.${string}`
      ? K
      : never
    : never
  : never;

export type Shift<R = {}, Prefix extends string = ""> =
  Pick<R, KeysWithPrefix<R, Prefix>> extends infer Picked
    ? {
        [K in keyof Picked as K extends `${Prefix}.${infer Rest}`
          ? Rest
          : never]: Picked[K];
      }
    : never;

/**
 * Recursively transforms an object type by replacing fields that can be populated with their populated types
 *
 * @template T - The original object type
 * @template Replacements - A mapping of field names to their populated types
 * @returns A new type with populated fields replaced by their populated types
 *
 * @example
 * ```ts
 * type User = { _id: mongoose.Types.ObjectId; name: string; companyId: mongoose.Types.ObjectId };
 * type Company = { _id: mongoose.Types.ObjectId; name: string };
 * type PopulatedUser = Populatedchema<User, { companyId: Company }>;
 * // Result: { _id: mongoose.Types.ObjectId; name: string; companyId: { _id: mongoose.Types.ObjectId; name: string } }
 * ```
 */
export type PopulateSchema<Schema = {}, Depth extends number = 10> = [
  Depth,
] extends [0]
  ? Schema
  : Schema extends RefTo<infer R>
    ? R | null
    : {
        [K in keyof Schema]: Schema[K] extends Scalar
          ? Schema[K] extends RefTo<infer R>
            ? CleanRef<R> | null
            : Schema[K]
          : Schema[K] extends Array<infer Element>
            ? PopulateSchema<Element, Prev[Depth]>[]
            : PopulateSchema<Schema[K], Prev[Depth]>;
      };

export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export type IsLeaf<T> = T extends Scalar ? true : false;

export type RecurseLeafPaths<
  T extends object = {},
  Prefix extends string = "",
  Depth extends number = 10,
> = keyof T extends infer K
  ? K extends keyof T
    ? Leafs<NonNullable<T[K]>, Join<Prefix, Extract<K, string>>, Prev[Depth]>
    : never
  : never;

/**
 * Recursively builds dot-separated paths to leaf properties (non-object properties)
 *
 * @template T - The object type to analyze
 * @template Prefix - The prefix to prepend to paths (used internally for recursion)
 * @returns A union of dot-separated paths to all leaf properties
 *
 * @example
 * ```ts
 * type User = {
 *   name: string;
 *   address: {
 *     street: string;
 *     city: string
 *   }
 * };
 * type Paths = LeafPaths<User>;
 * // Result: "name" | "address.street" | "address.city"
 * ```
 *
 */
export type Leafs<
  T = {},
  Prefix extends string = "",
  Depth extends number = 10,
> = [Depth] extends [0]
  ? never
  : IsLeaf<T> extends true
    ? Prefix
    : T extends Array<infer E>
      ? IsLeaf<E> extends true
        ? Prefix // array of leaves → include prefix only
        : // array of objects → include prefix (intermediate) and recurse on elements
            Prefix | Leafs<NonNullable<E>, Prefix, Prev[Depth]>
      : T extends object
        ? // Include prefix (intermediate object path) AND recurse on keys
            Prefix | RecurseLeafPaths<T, Prefix, Depth>
        : Prefix;

/**
 * Splits a dot-separated string path into a tuple of path segments
 *
 * @template S - The dot-separated string path to split
 * @returns A tuple of path segments
 *
 * @example
 * ```ts
 * type Path = SplitDotPath<"user.address.street">;
 * // Result: ["user", "address", "street"]
 *
 * type SimplePath = SplitDotPath<"name">;
 * // Result: ["name"]
 * ```
 */
export type SplitDotPath<S extends string = ""> =
  S extends `${infer Head}.${infer Tail}` ? [Head, ...SplitDotPath<Tail>] : [S];

export type PickIntersection<A = {}, B = {}> = Pick<
  A,
  Extract<keyof A, keyof B>
>;
export type PickTrue<A = {}> = {
  [K in keyof A as A[K] extends true ? K : never]: A[K];
};

export type SelectedPaths<
  T = {},
  Q extends Partial<Record<Leafs<T>, true>> = {},
> = Extract<keyof Q, string>;

// Check if a path starts with a given key
export type PathsForKey<Q extends any[] = [], K extends string = ""> = Extract<
  Q[number],
  `${K}` | `${K}.${string}`
>;

// Extract only direct matches (e.g., "user")
export type DirectMatch<Q extends any[] = [], K extends string = ""> = Extract<
  Q[number],
  K
>;

// Extract nested matches (e.g., "user.name" → "name")
export type NestedMatches<Q extends any[] = [], K extends string = ""> =
  Extract<Q[number], `${K}.${string}`> extends `${K}.${infer Rest}`
    ? [Rest]
    : [];

/**
 * Builds a nested selection object from a query object
 *
 * @template T - The object type to analyze
 * @template Q - A partial record mapping leaf paths to boolean values
 * @returns A nested object representing the selection
 *
 * @example
 * ```ts
 * type User = { name: string; address: { street: string; city: string } };
 * type Selection = NestedSelection<User, { name: true; "address.street": true }>;
 * // Result: { name: true; address: { street: true } }
 * ```
 */
export type NestedSelection<T = {}, Q extends any[] = []> = T extends any[]
  ? NestedSelection<Element<T>, Q>[]
  : {
      [K in keyof T as PathsForKey<Q, K & string> extends never
        ? never
        : K]: DirectMatch<Q, K & string> extends never
        ? T[K] extends any[]
          ? NestedSelection<Element<T[K]>, NestedMatches<Q, K & string>>[]
          : NestedSelection<T[K], NestedMatches<Q, K & string>>
        : T[K];
    };

export type TupleToUnion<Tuple extends any[]> = Tuple[number];

// extract subpaths for a key K: for includes like "friends.friend" and K="friends" -> "friend"
export type SubPathsForKey<
  Inc = "",
  K = "",
> = Inc extends `${K & string}.${infer Rest}` ? Rest : never;

// check if K is directly included (i.e. "company" is present in IncludeUnion)
export type HasDirectInclude<Inc = "", K = ""> =
  Extract<Inc, K> extends never ? false : true;

/**
 * Public entrypoint: Include is a readonly tuple (e.g. ["friends.friend","company"] as const)
 * Internally we operate on the union of include strings.
 */
export type SelectableFieldsAfterJoin<
  Base = {},
  Include extends any[] = [],
> = Leafs<SchemaAfterJoin<Base, TupleToUnion<Include>>>[];

/**
 * Core recursive type:
 * - If Base is an ObjectIdLike, use Full (populated)
 * - If Base is an array, recurse into element types
 * - If Base is object, iterate keys and:
 *    - if key directly included -> take Full[K]
 *    - else if subpaths exist -> recurse with only those subpaths
 *    - else keep Base[K]
 */
export type SchemaAfterJoin<Base = {}, IncludeUnion = ""> =
  // If this field was an ObjectId in the original, after populate it becomes Full
  Base extends RefTo<infer R>
    ? CleanRef<R> | null
    : // Arrays: preserve array, recurse element type
      Base extends readonly (infer U)[]
      ? SchemaAfterJoin<U, IncludeUnion>[]
      : // Plain object: map keys
        Base extends Scalar
        ? Base
        : {
            [K in keyof Base]: HasDirectInclude<IncludeUnion, K> extends true
              ? SchemaAfterJoin<Base[K]>
              : // else, if there are subpaths for this key (e.g. "friends.friend"), recurse with just those subpaths
                SubPathsForKey<IncludeUnion, K> extends never
                ? Base[K] // not included at all — keep base
                : SchemaAfterJoin<
                    Base[K],
                    SubPathsForKey<IncludeUnion, Extract<K, string>>
                  >;
          };

/**
 * Applies a selection filter (Mask) to a schema, returning only the requested fields.
 * * This utility is the engine behind "Projected" types. It recursively traverses
 * the object structure and preserves only the leaf paths specified in the selection array.
 *
 * @template T - The source schema (e.g., IUser)
 * @template Select - An array of dot-notation strings representing the allowed fields.
 * @template AllowMetadata - If true, attaches phantom types (__source, __mask) to the
 * result for downstream type inference and debugging.
 *
 * @example
 * ```ts
 * type User = { name: string; age: number; address: { street: string; zip: number } };
 * * // Result: { name: string; address: { street: string } }
 * type PartialUser = Mask<User, ["name", "address.street"]>;
 * * // Result: User (Empty array acts as a pass-through)
 * type FullUser = Mask<User, []>;
 * ```
 */
export type Mask<T, Select extends any[]> = Select extends []
  ? T
  : NestedSelection<T, Select>;

export type ExtractSelect<
  Base = {},
  Include extends any[] = [],
> = SelectableFieldsAfterJoin<Base, Include>;

export type ProjectedShape<
  Base,
  Include extends string,
  Select extends any[],
> = Mask<SchemaAfterJoin<Base, Include>, Select>;

export type RowIntent<Select, SortBy, PickDistinct> = {
  select: Select;
  limit?: number;
  offset?: number;
  sortBy?: SortBy;
  pickDistinct?: PickDistinct;
};

export type NewFieldsFromAgg<T> =
  T extends Array<infer Agg>
    ? Agg extends AggregateOperation<any, infer As>
      ? As
      : never
    : never;

export type GroupIntent<By, Aggs, SortBy> = {
  by: By;
  aggregates: Aggs;
  sortBy?: SortBy;
  limit?: number;
};

export type GroupResult<G extends GroupIntent<any, any, any>> = {
  category: { [K in G["by"][number]]: any };
} & (G["aggregates"] extends Array<infer A>
  ? { [K in Extract<A, { as: string }>["as"]]: number }
  : {});

export type ExecutorQueryResponse<
  Base,
  Include extends string[],
  Select extends string[],
  Groups extends Record<string, GroupIntent<string[], any[], any>> | undefined,
> = {
  rows: ProjectedShape<Base, TupleToUnion<Include>, Select>[];
} & (Groups extends Record<string, any>
  ? {
      groups?: {
        [K in keyof Groups]: GroupResult<
          // Use 'Extract' to prove to TS that this value satisfies GroupIntent
          Extract<Groups[K], GroupIntent<any, any, any>>
        >[];
      };
    }
  : {});

export type ExecutorMutationResponse<
  Base = {},
  Include extends any[] = [],
  Select extends any[] = [],
> = ProjectedShape<Base, TupleToUnion<Include>, Select>;

export type DefineGroupFn<Full> = <GroupBy extends Leafs<Full>[]>(
  by: GroupBy,
) => {
  by: GroupBy;
};

export type GroupHelper<Full> = <
  const Aggs extends AggregateOperation<Leafs<Full>, string>[],
  const By extends Leafs<Full>[],
>(
  group: GroupIntent<
    By,
    Aggs,
    SortByDefinition<Leafs<Full> | NewFieldsFromAgg<Aggs>>
  >,
) => typeof group;

export type RowHelper<Full> = <
  const Select extends Leafs<Full>[],
  const SortBy extends SortByDefinition<Leafs<Full>>,
  const PickDistinct extends PickDistinctDefinition<Full>,
>(row: {
  select: Select;
  sortBy?: SortBy;
  pickDistinct?: PickDistinct;
}) => typeof row;

export type ExecutorQueryParams<Full, Include, Rows, Groups> = {
  include?: Include;
  where?: WhereDefinition<Full>;
  groups?: (g: GroupHelper<Full>) => Groups;
  rows?: (r: RowHelper<Full>) => Rows;
};

export type MutationResponse<
  Base = {},
  Include extends any[] = [],
  Select extends any[] = [],
  Extra = {},
> = {
  [K in ExecutorKey]?: ExecutorMutationResponse<Base, Include, Select>;
} & {
  [K in RelatedKey]?: Extra;
};

export const EXECUTOR_KEY = "executor" as const;
export const RELATED_KEY = "related" as const;

export type ExecutorKey = typeof EXECUTOR_KEY; // "executor"
export type RelatedKey = typeof RELATED_KEY; // "related"

export type QueryResponse<
  Base,
  Include extends string[],
  Select extends string[],
  Groups extends Record<string, GroupIntent<any, any, any>> | undefined,
  Extra = undefined,
> = {
  [K in ExecutorKey]?: ExecutorQueryResponse<Base, Include, Select, Groups>;
} & (Extra extends undefined
  ? {}
  : {
      [K in RelatedKey]?: Extra;
    });

// Scalar operators
export type ScalarOperators<T> = {
  $eq?: T;
  $ne?: T;
  $in?: T[];
  $nin?: T[];
};

export type NumberOperators = {
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
};

export type DateOperators = {
  $gt?: Date;
  $gte?: Date;
  $lt?: Date;
  $lte?: Date;
};

export type ArrayOperators<T> = {
  $in?: T[];
  $nin?: T[];
  $size?: number;
  $all?: T[];
  $elemMatch?: T;
};

export type StringOperators = {
  $regex?: string | RegExp;
  $options?: string;
};

export type FlattenArray<
  T = {},
  Prefix extends string = "",
  Depth extends number = 10,
> = {
  [P in Prefix]?: ArrayOperators<
    DefaultOperators<FlattenForFilter<T, "", Prev[Depth]>>
  >;
};

export type FlattenObject<
  T = {},
  Prefix extends string = "",
  Depth extends number = 10,
> = {
  [K in keyof T]-?: FlattenForFilter<
    T[K],
    Join<Prefix, K & string>,
    Prev[Depth]
  >;
}[keyof T];

// --- Flatten nested objects into "path.to.key" keys, arrays wrapped in $elemMatch ---
export type FlattenForFilter<
  T = {},
  Prefix extends string = "",
  Depth extends number = 10,
> = [Depth] extends [never]
  ? {}
  : IsScalar<T> extends true
    ? Prefix extends ""
      ? FilterOperators<T>
      : { [P in Prefix]?: FilterOperators<T> }
    : IsScalar<T> extends true
      ? { [P in Prefix]?: FilterOperators<T> } // treat it like scalar
      : T extends (infer U)[]
        ? FlattenArray<U, Prefix, Depth>
        : FlattenObject<T, Prefix, Depth>;

// --- Add FilterOperators for scalars ---
export type FilterOperators<T> = T extends number
  ? (ScalarOperators<T> & NumberOperators) | T
  : T extends string
    ? (ScalarOperators<T> & StringOperators) | T
    : T extends Date
      ? ScalarOperators<T> & DateOperators
      : T extends RefTo<unknown>
        ? ScalarOperators<T>
        : T;

// --- Wrap flattened object with default Mongo operators ---
export type FilterWithOperators<T = {}, Depth extends number = 9> = [
  Depth,
] extends [never]
  ? T
  : DefaultOperators<T, Depth>;

export type DefaultOperators<T = {}, Depth extends number = 9> = T & {
  $and?: FilterWithOperators<T, Prev[Depth]>[];
  $or?: FilterWithOperators<T, Prev[Depth]>[];
  $nor?: FilterWithOperators<T, Prev[Depth]>[];
  $not?: FilterWithOperators<T, Prev[Depth]>;
};

export type WhereDefinition<FullObject = {}> = FilterWithOperators<
  FlattenForFilter<FullObject>
>;

export type SortDirection = 1 | -1;

export type SortByDefinition<Keys> = Partial<
  Record<Keys & string, SortDirection>
>;

export type AvailableGroupOperation =
  | "$sum"
  | "$avg"
  | "$min"
  | "$max"
  | "$count";

export const AGGREGATION_METADATA_KEY: unique symbol = Symbol("metadata");

export type AggregateOperation<TargetLeaf, As> = {
  as: As;
  on: TargetLeaf;
  fn: AvailableGroupOperation;
};

export type PickDistinctDefinition<T = {}> = {
  by: Leafs<T>;
  sortBy: Leafs<T>;
  keep: "first" | "last";
};

export * as Backend from "./helpers/backend";
export * as Frontend from "./helpers/frontend";

export interface AdiraConfig {
  output: {
    dir: string;
    file: string;
    typename: string;
  };
  registry: {
    port: number;
    url: string;
    version: string;
    name: string;
    description: string;
  };
  allowedDependencies: string[];
}

export type Serialize<T, R> = T & { __: R };
