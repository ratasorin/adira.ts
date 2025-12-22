/**
 * Marker type for ObjectId-like values.
 * By default it's just `{ _brand: "ObjectId" }`, but consumers can
 * override it via module augmentation or generics.
 */
export interface ObjectIdLike {
  readonly __objectIdBrand: unique symbol;
}

export type RefTo<T> = { __refTo?: T };
export type CleanRef<T> = {
  [K in keyof T]: T[K] extends RefTo<any> & ObjectIdLike ? string : T[K];
};

export type Keys<T> = keyof T;

export type Scalar =
  | ObjectIdLike
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
export type IsObjectId<T> = T extends ObjectIdLike ? true : false;

export type PopulatableKeys<
  T = {},
  Prefix extends string = "",
  Depth extends number = 10,
> = [Depth] extends [0]
  ? never
  : IsObjectId<T> extends true
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

export type ApplyReplacements<Schema = {}, Depth extends number = 10> = [
  Depth,
] extends [0]
  ? Schema
  : Schema extends ObjectIdLike
    ? Schema extends RefTo<infer R>
      ? R | null
      : ObjectIdLike
    : {
        [K in keyof Schema]: Schema[K] extends Scalar
          ? Schema[K] extends ObjectIdLike
            ? Schema[K] extends RefTo<infer R>
              ? CleanRef<R> | null
              : ObjectIdLike
            : Schema[K]
          : Schema[K] extends Array<infer Element>
            ? ApplyReplacements<Element, Prev[Depth]>[]
            : ApplyReplacements<Schema[K], Prev[Depth]>;
      };

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
export type PopulateSchema<Schema> = ApplyReplacements<Schema>;

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

export type IncludeUnionOf<T extends readonly any[]> = T[number];

// extract subpaths for a key K: for includes like "friends.friend" and K="friends" -> "friend"
export type SubPathsForKey<
  Inc = "",
  K extends string = "",
> = Inc extends `${K}.${infer Rest}` ? Rest : never;

// check if K is directly included (i.e. "company" is present in IncludeUnion)
export type HasDirectInclude<Inc = "", K extends string = ""> =
  Extract<Inc, K> extends never ? false : true;

/**
 * Public entrypoint: Include is a readonly tuple (e.g. ["friends.friend","company"] as const)
 * Internally we operate on the union of include strings.
 */
export type SelectableFieldsAfterJoin<
  Full = {},
  Base = {},
  Include extends readonly any[] = [],
> = _SelectableFieldsAfterJoin<Base, Full, IncludeUnionOf<Include>>;

/**
 * Core recursive type:
 * - If Base is an ObjectIdLike, use Full (populated)
 * - If Base is an array, recurse into element types
 * - If Base is object, iterate keys and:
 *    - if key directly included -> take Full[K]
 *    - else if subpaths exist -> recurse with only those subpaths
 *    - else keep Base[K]
 */
export type _SelectableFieldsAfterJoin<
  Base = {},
  Full = {},
  IncludeUnion extends string = "",
> =
  // If this field was an ObjectId in the original, after populate it becomes Full
  Base extends ObjectIdLike
    ? Full | null
    : // Arrays: preserve array, recurse element type
      Base extends readonly (infer U)[]
      ? Full extends readonly (infer UU)[]
        ? _SelectableFieldsAfterJoin<U, UU, IncludeUnion>[]
        : Base // mismatch, keep original (you might want to signal an error type here)
      : // Plain object: map keys
        Base extends object
        ? {
            [K in keyof Base]: K extends keyof Full
              ? // if the key is directly included (e.g. "company"), return the full populated type
                HasDirectInclude<IncludeUnion, Extract<K, string>> extends true
                ? Full[K] | null
                : // else, if there are subpaths for this key (e.g. "friends.friend"), recurse with just those subpaths
                  SubPathsForKey<IncludeUnion, Extract<K, string>> extends never
                  ? Base[K] // not included at all — keep base
                  : _SelectableFieldsAfterJoin<
                      Base[K],
                      Full[K],
                      SubPathsForKey<IncludeUnion, Extract<K, string>>
                    >
              : // key not present in Full (no population target) — keep base
                Base[K];
          }
        : // primitives: just keep Base
          Base;

/**
 * Picks properties from an object type based on a query
 *
 * @template T - The source object type
 * @template Q - A query object that specifies which properties to pick
 * @returns A new object type with only the properties specified by the query
 *
 * @example
 * ```ts
 * type User = { name: string; age: number; address: { street: string; city: string } };
 * type Picked = PickFromQuery<User, { name: true; "address.street": true }>;
 * // Result: { name: string; address: { street: string } }
 *
 * type All = PickFromQuery<User, undefined>;
 * // Result: User (no filtering)
 * ```
 */
export type PickFromQuery<
  T = {},
  Select extends any[] = [],
  AllowMetadata extends boolean = true,
  BaseT = {},
> = Select extends []
  ? T
  : (AllowMetadata extends true
      ? {
          /** Phantom type tag for inference */
          __source?: T;
          __mask?: Select;
          __base?: BaseT;
        }
      : {}) &
      NestedSelection<T, Exclude<Select, undefined>>;

export type OmitBranded<T = {}, K extends string = ""> = {
  __base?: T;
} & Omit<T, K>;

export type BuildResponseBody<
  FullSchema = {},
  BaseSchema = {},
  Include extends any[] = [],
  Select extends any[] = [],
  GroupOperations extends
    | GroupOperationsDefinition<any>
    | undefined = undefined,
  Extra = {},
  IsQuery extends boolean = false,
> = (IsQuery extends true
  ? ExtractResponseBodyQUERY<
      FullSchema,
      BaseSchema,
      Include,
      Select,
      GroupOperations,
      Extra
    >
  : ExtractResponseBodyMUTATE<
      FullSchema,
      BaseSchema,
      Include,
      Select,
      Extra
    >) & {
  __full?: FullSchema;
  __base?: BaseSchema;
};

export type TopLevelKeysUnion<Q extends string = ""> =
  Q extends `${infer F}.${string}` ? F : Q;
export type TopLevelKeys<Q extends any[] = []> = TopLevelKeysUnion<Q[number]>[];

export type ExtractSelect<
  Full = {},
  Base = {},
  Include extends any[] = [],
> = Leafs<SelectableFieldsAfterJoin<Full, Base, Include>>[];

export type EnhacedExtractSelect<
  Full = {},
  Base = {},
  Include extends any[] = [],
> = ExtractSelect<Full, Base, Include> & {
  __full?: Full;
  __base?: Base;
};

// Core extraction (no array wrapping)
// export type ExtractBase<
//   FullObject = {},
//   Base = {},
//   Include extends any[] = [],
//   Select extends any[] = [],
//   GroupOperations = []
// > = GroupOperations extends []
//   ? PickFromQuery<FullObject, Include, false> &
//       Omit<Base, TopLevelKeys<Include>[number]> extends infer R
//     ? Select extends []
//       ? R
//       : PickFromQuery<R, Select, false, Base> &
//           PickFromQuery<
//             Omit<Base, keyof TopLevelKeys<Include>>,
//             Exclude<Select[number], Leafs<R>>[],
//             false
//           >
//     : {}
//   : {
//       documents: PickFromQuery<FullObject, Include, false> &
//         Omit<Base, TopLevelKeys<Include>[number]> extends infer R
//         ? Select extends []
//           ? R
//           : PickFromQuery<R, Select, false, Base> &
//               PickFromQuery<
//                 Omit<Base, keyof TopLevelKeys<Include>>,
//                 Exclude<Select[number], Leafs<R>>[],
//                 false
//               >
//         : {};
//       grouped: GroupOperations extends Array<{ alias: string }>
//         ? { [K in GroupOperations[number]["alias"]]: number }
//         : {};
//     };

export type ExtractBase<
  FullObject = {},
  Base = {},
  Include extends any[] = [],
  Select extends any[] = [],
> = PickFromQuery<FullObject, Include, false> &
  Omit<Base, TopLevelKeys<Include>[number]> extends infer R
  ? Select extends []
    ? R
    : PickFromQuery<R, Select, false, Base> &
        PickFromQuery<
          Omit<Base, keyof TopLevelKeys<Include>>,
          Exclude<Select[number], Leafs<R>>[],
          false
        >
  : {};

export type ExtractResponseQUERY<
  FullObject = {},
  Base = {},
  Include extends any[] = [],
  Select extends any[] = [],
  GroupOperations extends { as: string }[] | undefined = undefined,
> = {
  documents: ExtractBase<
    CleanRef<FullObject>,
    CleanRef<Base>,
    Include,
    Select
  >[];
  grouped: GroupOperations extends Array<{ as: string }>
    ? ({
        [K in GroupOperations[number]["as"]]: number;
      } & { _id: string })[]
    : [];
};

export type ExtractResponseMUTATE<
  FullObject = {},
  Base = {},
  Include extends any[] = [],
  Select extends any[] = [],
> = ExtractBase<FullObject, Base, Include, Select>;

// Single object
export type ExtractResponseBodyMUTATE<
  FullObject = {},
  Base = {},
  Include extends any[] = [],
  Select extends any[] = [],
  Extra = {},
> = {
  [K in ExecutorKey]?: ExtractResponseMUTATE<FullObject, Base, Include, Select>;
} & {
  [K in ExtraKey]?: Extra;
};

export const EXECUTOR_KEY = "executor" as const;
export const EXTRA_KEY = "extra" as const;

export type ExecutorKey = typeof EXECUTOR_KEY; // "executor"
export type ExtraKey = typeof EXTRA_KEY; // "extra"

// Array of objects
export type ExtractResponseBodyQUERY<
  FullObject = {},
  Base = {},
  Include extends any[] = [],
  Select extends any[] = [],
  GroupOperations extends
    | GroupOperationsDefinition<any>
    | undefined = undefined,
  Extra = {},
> = {
  [K in ExecutorKey]?: ExtractResponseQUERY<
    FullObject,
    Base,
    Include,
    Select,
    GroupOperations
  >;
} & {
  [K in ExtraKey]?: Extra;
};

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
      : T extends ObjectIdLike
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

export type FilterDefinition<FullObject = {}> = FilterWithOperators<
  FlattenForFilter<FullObject>
>;

export type SortDirection = 1 | -1;

export type SortByDefinition<FullObject = {}> = Partial<
  Record<Leafs<FullObject> & string, SortDirection>
>;

export type AvailableGroupOperation =
  | "$sum"
  | "$avg"
  | "$min"
  | "$max"
  | "$count";

export type GroupOperationsDefinition<TargetLeaf> = Array<{
  target: TargetLeaf;
  operation: AvailableGroupOperation;
  as: string;
}>;

export type GroupByDefinition<
  Fields extends any[] = [],
  GroupOperations extends any[] = [],
> = {
  fields: Fields;
  operations: GroupOperations;
};

export type RowsPrunerDefiniton<T = {}> = {
  partitionBy: Leafs<T>;
  orderBy: Leafs<T>;
  pick: "first" | "last";
};

export * as Backend from "./helpers/backend";
export * as Frontend from "./helpers/frontend";

import {
  HTTPMethod,
  PublicAPIPaths,
  APIMethods,
  ExtractMetadata,
  ExtractFull,
  ExtractReqInclude,
  ExtractReqSelect,
  ExtractResBody,
  ExtractReqBody,
  ExtractQueryParams,
  ExtractReqPath,
} from "./helpers/frontend";

export type CreateApiClient<
  API extends Record<string, Partial<Record<HTTPMethod, any>>>,
> = (baseUrl: string) => <
  Metadata extends ExtractMetadata<Endpoint, Method>,
  Full extends ExtractFull<Metadata>,
  PublicPaths extends PublicAPIPaths<API>,
  Path extends keyof PublicPaths & string,
  Method extends APIMethods<API, PublicPaths[Path] & keyof API>,
  Include extends ExtractReqInclude<Endpoint, Method>,
  Select extends ExtractReqSelect<Endpoint, Method, Include>,
  GroupOperations extends GroupOperationsDefinition<Leafs<Full>>,
  Data extends ExtractReqBody<Endpoint, Method>,
  QueryParams extends ExtractQueryParams<Endpoint, Method>,
  PathParam extends ExtractReqPath<Endpoint, Method>,
  Endpoint extends API[keyof API] = API[PublicPaths[Path] & keyof API],
>(
  url: Path,
  method: Method,
  {
    data,
    path,
    query,
  }: {
    query?: { include: Include; select: Select } & (Method extends "GET"
      ? { groupBy?: GroupByDefinition<Leafs<Full>[], GroupOperations> }
      : {}) &
      QueryParams;
    data?: Method extends "GET" ? never : Data;
    path?: PathParam;
  },
) => Promise<
  ExtractResBody<Endpoint, Method, Include, Select, GroupOperations>
>;

export interface AdiraConfig {
  output: {
    dir: string;
    file?: string;
    typename?: string;
  };
  registry: {
    port: number;
    url: string;
    version: string;
    name: string;
  };
  allowedDependencies: string[];
}

export type Serialize<T, R> = T & { __: R };
