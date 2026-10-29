import { assertReadKey, schema, ValueSchema } from "./schema";

export type ReadOperator =
  | "$eq"
  | "$ne"
  | "$in"
  | "$nin"
  | "$gt"
  | "$gte"
  | "$lt"
  | "$lte"
  | "$startsWith"
  | "$contains";
export type AllowedOperators<T> =
  | "$eq"
  | "$ne"
  | "$in"
  | "$nin"
  | (NonNullable<T> extends number ? "$gt" | "$gte" | "$lt" | "$lte" : never)
  | (NonNullable<T> extends string ? "$startsWith" | "$contains" : never);

export interface ScalarDefinition<
  T = unknown,
  Ops extends ReadOperator = ReadOperator,
  Sortable extends boolean = boolean,
> {
  readonly kind: "scalar";
  readonly value: ValueSchema<T>;
  readonly operators: readonly Ops[];
  readonly sortable: Sortable;
}

export class ScalarField<
  T,
  Ops extends ReadOperator = never,
  Sortable extends boolean = false,
> implements ScalarDefinition<T, Ops, Sortable> {
  readonly kind = "scalar";
  constructor(
    readonly value: ValueSchema<T>,
    readonly operators: readonly Ops[] = [],
    readonly sortable: Sortable = false as Sortable,
  ) {}

  filterable<const Next extends readonly AllowedOperators<T>[]>(
    ...operators: Next
  ): ScalarField<T, Ops | Next[number], Sortable> {
    return new ScalarField(
      this.value,
      [...new Set([...this.operators, ...operators])],
      this.sortable,
    );
  }

  orderable(): ScalarField<T, Ops, true> {
    return new ScalarField(this.value, this.operators, true);
  }

  nullable(): ScalarField<T | null, Ops, Sortable> {
    return new ScalarField(
      schema.nullable(this.value),
      this.operators,
      this.sortable,
    );
  }
}

export interface ResourceLike {
  readonly fields: Readonly<Record<string, FieldDefinition>>;
  readonly predicates: Readonly<Record<string, ScalarDefinition>>;
}

export class RelationField<
  R extends ResourceLike,
  Many extends boolean,
  Nullable extends boolean = false,
> {
  readonly kind = "relation";
  constructor(
    readonly resource: R,
    readonly many: Many,
    readonly allowsNull: Nullable = false as Nullable,
  ) {}
  nullable(): RelationField<R, Many, true> {
    return new RelationField(this.resource, this.many, true);
  }
}

export type FieldDefinition =
  | ScalarDefinition
  | RelationField<ResourceLike, boolean, boolean>;
export type FieldValue<F> =
  F extends ScalarDefinition<infer T>
    ? T
    : F extends RelationField<infer R, infer Many, infer Nullable>
      ?
          | (Many extends true ? ResourceValue<R>[] : ResourceValue<R>)
          | (Nullable extends true ? null : never)
      : never;
export type ResourceValue<R extends ResourceLike> = {
  [K in keyof R["fields"]]: FieldValue<R["fields"][K]>;
};

export class ReadResource<
  Fields extends Readonly<Record<string, FieldDefinition>>,
  Predicates extends Readonly<Record<string, ScalarDefinition>>,
> implements ResourceLike {
  constructor(
    readonly fields: Fields,
    readonly predicates: Predicates,
  ) {}
}

export function defineResource<
  const Fields extends Readonly<Record<string, FieldDefinition>>,
  const Predicates extends Readonly<Record<string, ScalarDefinition>> = {},
>(
  fields: Fields,
  options?: { predicates?: Predicates },
): ReadResource<Fields, Predicates> {
  const predicates = options?.predicates ?? ({} as Predicates);
  for (const key of [...Object.keys(fields), ...Object.keys(predicates)])
    assertReadKey(key);
  for (const key of Object.keys(predicates)) {
    if (key in fields)
      throw new Error(`Predicate '${key}' conflicts with a resource field`);
    if (!predicates[key].operators.length)
      throw new Error(`Predicate '${key}' needs at least one operator`);
  }
  return new ReadResource(
    Object.freeze({ ...fields }) as Fields,
    Object.freeze({ ...predicates }) as Predicates,
  );
}

export const field = {
  string: () => new ScalarField(schema.string()),
  number: () => new ScalarField(schema.number()),
  boolean: () => new ScalarField(schema.boolean()),
  enum: <const Values extends readonly string[]>(values: Values) =>
    new ScalarField(schema.enum(values)),
  one: <R extends ResourceLike>(resource: R) =>
    new RelationField(resource, false),
  many: <R extends ResourceLike>(resource: R) =>
    new RelationField(resource, true),
};

export type FilterDefinitions<R extends ResourceLike> = {
  [K in keyof R["fields"] as R["fields"][K] extends ScalarDefinition
    ? K
    : never]: R["fields"][K];
} & R["predicates"];
export type FilterKeys<R extends ResourceLike> = {
  [K in keyof FilterDefinitions<R>]: FilterDefinitions<R>[K] extends ScalarDefinition<
    unknown,
    infer Ops
  >
    ? [Ops] extends [never]
      ? never
      : K
    : never;
}[keyof FilterDefinitions<R>];
export type OperatorValue<F, Op> =
  F extends ScalarDefinition<infer T>
    ? Op extends "$in" | "$nin"
      ? readonly T[]
      : Op extends "$startsWith" | "$contains"
        ? string
        : Op extends "$gt" | "$gte" | "$lt" | "$lte"
          ? NonNullable<T>
          : T
    : never;
export type OperatorsOf<F> =
  F extends ScalarDefinition<unknown, infer Ops> ? Ops : never;
export type SortableKeys<R extends ResourceLike> = {
  [K in keyof R["fields"]]: R["fields"][K] extends ScalarDefinition<
    unknown,
    ReadOperator,
    true
  >
    ? K
    : never;
}[keyof R["fields"]] &
  string;
