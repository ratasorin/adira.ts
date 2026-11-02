import type { Document, Model, PipelineStage } from "mongoose";
import type { IndexMatch } from "./index-match";
import {
  assertReadKey,
  ExactReadQuery,
  FieldValue,
  FilterDefinitions,
  FilterKeys,
  ObjectSchema,
  OperatorsOf,
  OperatorValue,
  ReadLimits,
  ReadData,
  ReadQuery,
  ReadWhere,
  RelationField,
  ResourceLike,
  ScalarDefinition,
  SchemaValue,
  SortableKeys,
  ValueSchema,
} from "@n/adira.core.ts";
import {
  DataRow,
  Expressions,
  MaybePromise,
  MongoExpression,
} from "./expression";

type Key<Row> = keyof Row & string;
type Replace<Row, Name extends string, Value> = Omit<Row, Name> &
  Record<Name, Value>;
type SchemaFields = Record<string, ValueSchema<unknown>>;
type SchemaRow<F extends SchemaFields> = { [K in keyof F]: SchemaValue<F[K]> };
type WithFields<Row, Fields extends SchemaFields> = Omit<Row, keyof Fields> &
  SchemaRow<Fields>;

/** An unconditional pipeline may change row shape, membership, and ordering. */
export interface NativeTransformOptions<
  Row extends object,
  Fields extends SchemaFields,
> {
  readonly stages: readonly PipelineStage[];
  readonly output: ObjectSchema<Fields>;
  readonly preserves?: readonly (Key<Row> & keyof Fields)[];
  readonly provides?: never;
  readonly requires?: never;
}

/** A demand-driven producer promises to preserve rows and all undeclared fields. */
export interface NativeProducerOptions<
  Row extends object,
  Fields extends SchemaFields,
  Needs extends readonly Key<Row>[],
  Provides extends readonly string[],
> {
  readonly provides: Provides &
    readonly (keyof NoInfer<Fields> & string)[] &
    ([Exclude<keyof Fields, Provides[number]>] extends [never]
      ? unknown
      : {
          readonly missingProvidedFields: Exclude<
            keyof Fields,
            Provides[number]
          >;
        });
  readonly requires: Needs;
  readonly stages: readonly PipelineStage[];
  readonly output: ObjectSchema<Fields>;
  readonly preserves?: never;
}

declare const batchParentRef: unique symbol;
/** Opaque, invocation-local identity. Return the original reference unchanged. */
export type BatchParentRef = { readonly [batchParentRef]: true };

export interface BatchParent<Row extends object> {
  readonly ref: BatchParentRef;
  readonly row: Readonly<Row>;
}

export interface BatchRelationResult<Row extends object> {
  readonly ref: BatchParentRef;
  readonly rows: readonly Row[];
}

export interface BatchRelationOptions<
  Parent extends object,
  Needs extends readonly Key<Parent>[],
  Fields extends SchemaFields,
  Context = unknown,
> {
  readonly requires: Needs;
  readonly output: ObjectSchema<Fields>;
  /** Maximum parents per invocation; defaults to the parent plan's batch size. */
  readonly batchSize?: number;
  /** Return one entry per parent, including an empty rows array for no matches. */
  readonly resolveBatch: (input: {
    readonly parents: readonly BatchParent<Pick<Parent, Needs[number]>>[];
    readonly context: Context;
  }) => MaybePromise<readonly BatchRelationResult<SchemaRow<Fields>>[]>;
}

export interface BatchRelationProvider {
  readonly requires: readonly string[];
  readonly output: ValueSchema<object>;
  readonly resolveBatch: (input: {
    readonly parents: readonly BatchParent<DataRow>[];
    readonly context: unknown;
  }) => MaybePromise<readonly BatchRelationResult<object>[]>;
}

export interface CollectionAdapter {
  readonly name: string;
  readonly database: unknown;
  scan(pipeline: PipelineStage[], batchSize: number): AsyncIterable<DataRow>;
}

export type ApplicationStage =
  | {
      kind: "load";
      key: string;
      requires: readonly string[];
      dependency: RelationDependency<object, unknown>;
    }
  | {
      kind: "derive";
      key: string;
      requires: readonly string[];
      run: (row: DataRow, context: unknown) => MaybePromise<unknown>;
    }
  | {
      kind: "map";
      run: (row: DataRow, context: unknown) => MaybePromise<object>;
    }
  | {
      kind: "filter";
      run: (row: DataRow, context: unknown) => MaybePromise<boolean>;
    }
  | {
      kind: "batch";
      run: (
        rows: readonly DataRow[],
        context: unknown,
      ) => MaybePromise<readonly object[]>;
    };

export type NativeOperation =
  | {
      readonly kind: "derive";
      readonly key: string;
      readonly requires: ReadonlySet<string>;
      readonly output?: ValueSchema<unknown>;
    }
  | { readonly kind: "consume"; readonly requires: ReadonlySet<string> }
  | { readonly kind: "project"; readonly keys: ReadonlySet<string> }
  | { readonly kind: "producer"; readonly producer: NativeFieldProducer };

export interface NativeFieldProducer {
  readonly provides: ReadonlySet<string>;
  readonly requires: ReadonlySet<string>;
  readonly stages: readonly PipelineStage[];
  readonly output: ReadonlyMap<string, ValueSchema<unknown>>;
}

export interface PlanState {
  readonly scope: object;
  readonly requiresContext?: boolean;
  readonly collection: CollectionAdapter;
  readonly stages: readonly PipelineStage[];
  /** Unannotated raw stages conservatively observe every preceding column. */
  readonly nativeOperations?: ReadonlyMap<PipelineStage, NativeOperation>;
  /** Source-input policy, evaluated before every native transformation. */
  readonly inputScope?: (context: unknown) => unknown;
  /** Complete candidates supplied by a parent-batch loader, without a native prefix. */
  readonly provider?: BatchRelationProvider;
  readonly nativeKeys: ReadonlySet<string>;
  /** Columns actually returned by the native prefix, including overwritten app inputs. */
  readonly materializedKeys: ReadonlySet<string>;
  readonly nativeOrigins: ReadonlyMap<string, string>;
  readonly validators: ReadonlyMap<string, ValueSchema<unknown>>;
  /** Raw output contracts stay eager; managed derivations validate on demand. */
  readonly eagerValidators?: ReadonlySet<string>;
  readonly application: readonly ApplicationStage[];
  readonly batchSize: number;
  readonly concurrency: number;
}

/** Execution input only: consuming a plan must not retype its fluent callbacks. */
export interface ReadSource<Row extends object, Context = unknown> {
  readonly __row: Row;
  readonly __context: (context: Context) => void;
  readonly __rootPlan: true;
  readonly state: PlanState;
}
export interface MongoSource<
  Row extends object,
  Context = unknown,
> extends ReadSource<Row, Context> {
  readonly __phase: "mongodb";
}
export interface AppSource<
  Row extends object,
  Context = unknown,
> extends ReadSource<Row, Context> {
  readonly __phase: "application";
}

export interface NativeCondition {
  readonly stages: readonly PipelineStage[];
  readonly test: unknown;
  readonly output: Readonly<Record<string, ValueSchema<unknown>>>;
  readonly indexMatch?: IndexMatch;
}

export class Condition<Row extends object, Context = unknown> {
  declare readonly __input: (row: Row) => void;
  declare readonly __context: (context: Context) => void;
  constructor(
    readonly scope: object,
    readonly requires: ReadonlySet<string>,
    readonly native?: NativeCondition,
    readonly evaluate?: (
      row: DataRow,
      context: Context,
    ) => MaybePromise<boolean>,
  ) {}
}

type HandlerMap<Field, Row extends object, Context> = {
  [Operator in OperatorsOf<Field>]: (
    value: OperatorValue<Field, Operator>,
  ) => Condition<Row, Context>;
};
type PublicFilterHandlers<
  R extends ResourceLike,
  Row extends object,
  Context = unknown,
> = {
  [K in FilterKeys<R> & keyof R["fields"]]?: Partial<
    HandlerMap<FilterDefinitions<R>[K], Row, Context>
  >;
};
export type FilterHandlers<
  R extends ResourceLike,
  Row extends object,
  Context = unknown,
> = PublicFilterHandlers<R, Row, Context> & {
  [K in keyof R["predicates"]]: HandlerMap<R["predicates"][K], Row, Context>;
};
type RelationKeys<R extends ResourceLike> = {
  [K in keyof R["fields"]]: R["fields"][K] extends RelationField<
    ResourceLike,
    boolean,
    boolean
  >
    ? K
    : never;
}[keyof R["fields"]];
declare const missingFromPlan: unique symbol;
declare const outputTypeMismatch: unique symbol;

type MissingPlanField<Name extends PropertyKey> = {
  readonly [missingFromPlan]: Name;
};

type CompatibleField<Field extends ScalarDefinition, Value> = [Value] extends [
  FieldValue<Field>,
]
  ? Field
  : [FieldValue<Field>] extends [Value]
    ? {
        // A covariant schema comparison alone would accept a narrow public
        // field over a wider plan value (for example number over number|null).
        readonly [outputTypeMismatch]: {
          readonly expected: FieldValue<Field>;
          readonly received: Value;
        };
      }
    : ScalarDefinition<Value>;

// An index signature describes the value of a key if it exists; it does not
// establish that a particular public field is present in every output row.
type DeclaredPlanKeys<Row> = keyof {
  [K in keyof Row as string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K]: Row[K];
};

type CompatibleFields<R extends ResourceLike, Row extends object> = {
  [K in keyof R["fields"]]: R["fields"][K] extends ScalarDefinition
    ? K extends keyof Row & DeclaredPlanKeys<Row>
      ? [Row] extends [Record<K, Row[K]>]
        ? CompatibleField<R["fields"][K], Row[K]>
        : MissingPlanField<K>
      : MissingPlanField<K>
    : R["fields"][K];
};

/** Compare public scalar fields at the resource argument, without changing arity. */
export type CompatibleResource<
  R extends ResourceLike,
  Row extends object,
> = R & {
  readonly fields: CompatibleFields<NoInfer<R>, Row>;
};

export type RelationBindings<
  R extends ResourceLike,
  Row extends object,
  Context = unknown,
> = {
  [K in RelationKeys<R>]: R["fields"][K] extends RelationField<
    infer Child,
    infer Many,
    boolean
  >
    ? RelationBinding<Row, Child, Many, Context>
    : never;
};

export type ReaderOptions<
  R extends ResourceLike,
  Row extends object,
  Context = unknown,
> = {
  source: ReadSource<Row, Context>;
  limits?: Partial<ReadLimits>;
  defaultOrderBy?: Partial<Record<SortableKeys<R>, "asc" | "desc">>;
  scope?: (context: NoInfer<Context>) => Condition<Row, NoInfer<Context>>;
} & ([RelationKeys<R>] extends [never]
  ? { relations?: RelationBindings<R, Row, NoInfer<Context>> }
  : { relations: RelationBindings<R, Row, NoInfer<Context>> }) &
  ([keyof R["predicates"]] extends [never]
    ? { filters?: FilterHandlers<R, Row, NoInfer<Context>> }
    : { filters: FilterHandlers<R, Row, NoInfer<Context>> });

export interface RuntimeReaderOptions {
  source: { readonly state: PlanState };
  limits?: Partial<ReadLimits>;
  defaultOrderBy?: Record<string, "asc" | "desc">;
  scope?: (context: unknown) => Condition<object>;
  relations?: Record<string, RelationBinding<object, ResourceLike, boolean>>;
  filters?: Record<
    string,
    Record<string, (value: unknown) => Condition<object>>
  >;
}

/** Complete selections cannot contain display pagination, including nested relations. */
export type RelationAllQuery<R extends ResourceLike> = Omit<
  ReadQuery<R>,
  "select" | "page"
> & {
  select: {
    [K in keyof R["fields"]]?: R["fields"][K] extends RelationField<
      infer Child,
      infer Many,
      boolean
    >
      ? Many extends true
        ? RelationAllQuery<Child>
        : Pick<RelationAllQuery<Child>, "select" | "where">
      : true;
  };
};

export type RelationWhereQuery<R extends ResourceLike> = {
  where?: ReadWhere<R>;
};
export type NumericResourceKeys<R extends ResourceLike> = {
  [K in keyof R["fields"]]: R["fields"][K] extends ScalarDefinition<infer Value>
    ? [NonNullable<Value>] extends [never]
      ? never
      : NonNullable<Value> extends number
        ? K
        : never
    : never;
}[keyof R["fields"]] &
  string;
export type RelationNumericQuery<R extends ResourceLike> =
  RelationWhereQuery<R> & {
    field: NumericResourceKeys<R>;
  };
type AtLeastOne<T> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>;
}[keyof T];
export type RelationFirstQuery<R extends ResourceLike> = Omit<
  RelationAllQuery<R>,
  "orderBy"
> & {
  orderBy: AtLeastOne<NonNullable<ReadQuery<R>["orderBy"]>>;
};
type ExactRelationOptions<
  R extends ResourceLike,
  Q,
  Allowed extends string,
> = ExactReadQuery<R, Omit<Q, "field">> & {
  [K in Exclude<keyof Q, Allowed>]: never;
};

export type RelationOperation =
  | "all"
  | "count"
  | "exists"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "first"
  | "last"
  | "get";

type ExactRelationAllQuery<R extends ResourceLike, Q> = ExactReadQuery<R, Q> & {
  [K in keyof Q]: K extends "page"
    ? never
    : K extends "select"
      ? {
          [F in keyof Q[K]]: F extends keyof R["fields"]
            ? R["fields"][F] extends RelationField<
                infer Child,
                boolean,
                boolean
              >
              ? ExactRelationAllQuery<Child, Q[K][F]>
              : unknown
            : never;
        }
      : unknown;
};

/** A lazy description of a complete relation view, consumed by AppPlan.load(). */
export class RelationDependency<
  Parent extends object,
  Value,
  Context = unknown,
> {
  declare readonly __parent: (row: Parent) => void;
  declare readonly __context: (context: Context) => void;
  declare readonly __value: Value;

  constructor(
    readonly binding: RelationBinding<Parent, ResourceLike, boolean, Context>,
    readonly query: unknown,
    readonly operation: RelationOperation = "all",
    readonly field?: string,
  ) {}
}

export class RelationBinding<
  Parent extends object,
  R extends ResourceLike,
  Many extends boolean,
  Context = unknown,
> {
  declare readonly __parent: (row: Parent) => void;
  declare readonly __context: (context: Context) => void;
  constructor(
    readonly resource: R,
    readonly many: Many,
    readonly parentScope: object,
    readonly localField: string | undefined,
    readonly foreignField: string | undefined,
    readonly options: RuntimeReaderOptions,
  ) {}

  get requires(): readonly string[] {
    const provider = this.options.source.state.provider;
    if (provider) return provider.requires;
    if (this.localField === undefined)
      throw new Error("A MongoDB relation requires a local field");
    return [this.localField];
  }

  all<const Q extends RelationAllQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query: Q & ExactRelationAllQuery<R, Q>,
  ): RelationDependency<Parent, Readonly<ReadData<R, Q>["rows"]>, Context> {
    if (!this.many) throw new Error("all() requires a to-many relation");
    return new RelationDependency(this, query);
  }

  count<const Q extends RelationWhereQuery<R> = RelationWhereQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query?: Q & ExactRelationOptions<R, Q, "where">,
  ): RelationDependency<Parent, number, Context> {
    return this.aggregate("count", query ?? {});
  }

  exists<const Q extends RelationWhereQuery<R> = RelationWhereQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query?: Q & ExactRelationOptions<R, Q, "where">,
  ): RelationDependency<Parent, boolean, Context> {
    return this.aggregate("exists", query ?? {});
  }

  sum<const Q extends RelationNumericQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query: Q & ExactRelationOptions<R, Q, "where" | "field">,
  ): RelationDependency<Parent, number, Context> {
    return this.aggregate("sum", query, query.field);
  }

  avg<const Q extends RelationNumericQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query: Q & ExactRelationOptions<R, Q, "where" | "field">,
  ): RelationDependency<Parent, number | null, Context> {
    return this.aggregate("avg", query, query.field);
  }

  min<const Q extends RelationNumericQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query: Q & ExactRelationOptions<R, Q, "where" | "field">,
  ): RelationDependency<Parent, number | null, Context> {
    return this.aggregate("min", query, query.field);
  }

  max<const Q extends RelationNumericQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query: Q & ExactRelationOptions<R, Q, "where" | "field">,
  ): RelationDependency<Parent, number | null, Context> {
    return this.aggregate("max", query, query.field);
  }

  first<const Q extends RelationFirstQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query: Q & ExactRelationAllQuery<R, Q>,
  ): RelationDependency<
    Parent,
    ReadData<R, Q>["rows"][number] | null,
    Context
  > {
    return this.aggregate("first", query);
  }

  last<const Q extends RelationFirstQuery<R>>(
    this: RelationBinding<Parent, R, true, Context>,
    query: Q & ExactRelationAllQuery<R, Q>,
  ): RelationDependency<
    Parent,
    ReadData<R, Q>["rows"][number] | null,
    Context
  > {
    return this.aggregate("last", query);
  }

  get<const Q extends Pick<RelationAllQuery<R>, "select" | "where">>(
    this: RelationBinding<Parent, R, false, Context>,
    query: Q &
      ExactRelationAllQuery<R, Q> & {
        [K in Exclude<keyof Q, "select" | "where">]: never;
      },
  ): RelationDependency<
    Parent,
    ReadData<R, Q>["rows"][number] | null,
    Context
  > {
    return this.aggregate("get", query);
  }

  private aggregate<Value>(
    operation: RelationOperation,
    query: unknown,
    field?: string,
  ): RelationDependency<Parent, Value, Context> {
    if (this.many !== (operation !== "get"))
      throw new Error(
        `${operation}() requires a ${operation === "get" ? "to-one" : "to-many"} relation`,
      );
    return new RelationDependency(this, query, operation, field);
  }
}

type JoinValue<T> =
  NonNullable<T> extends readonly (infer Element)[]
    ? NonNullable<Element>
    : NonNullable<T>;
type JoinFields<
  Parent extends object,
  Child extends object,
  Local extends Key<Parent>,
  Foreign extends Key<Child>,
> = {
  localField: Local;
  foreignField: Foreign &
    (JoinValue<Parent[Local]> extends JoinValue<Child[Foreign]>
      ? unknown
      : never);
};
type JoinOptions<
  Parent extends object,
  R extends ResourceLike,
  Child extends object,
  Local extends Key<Parent>,
  Foreign extends Key<Child>,
  Context = unknown,
> = Omit<ReaderOptions<R, Child, Context>, "source"> & {
  plan: ReadSource<Child, Context>;
} & JoinFields<Parent, Child, Local, Foreign>;

interface RelationContext {
  readonly parentScope: object;
  readonly localField?: string;
  readonly foreignField?: string;
}

function batchRelation<
  Parent extends object,
  Context,
  const Needs extends readonly Key<Parent>[],
  const Fields extends SchemaFields,
>(
  parent: PlanState,
  options: BatchRelationOptions<Parent, Needs, Fields, Context>,
): AppRelationPlan<Parent, SchemaRow<Fields>, Context> {
  const batchSize = options.batchSize ?? parent.batchSize;
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0 || batchSize > 10_000)
    throw new Error("Batch size must be a positive integer up to 10000");
  options.requires.forEach(assertReadKey);
  if (typeof options.resolveBatch !== "function")
    throw new Error("resolveBatch must be a function");
  const state: PlanState = {
    scope: {},
    requiresContext: parent.requiresContext,
    // Retained only as an adapter anchor; provider execution never scans it.
    collection: parent.collection,
    stages: [],
    nativeKeys: new Set(),
    materializedKeys: new Set(Object.keys(options.output.fields)),
    nativeOrigins: new Map(),
    validators: new Map(),
    application: [],
    batchSize,
    concurrency: parent.concurrency,
    provider: {
      requires: [...options.requires],
      output: options.output,
      resolveBatch:
        options.resolveBatch as BatchRelationProvider["resolveBatch"],
    },
  };
  return new AppRelationPlan(new AppPlan(state), { parentScope: parent.scope });
}

function relationContext(
  parent: PlanState,
  child: PlanState,
  join: { localField: string; foreignField: string },
): RelationContext {
  if (child.nativeOrigins.get(join.foreignField) !== join.foreignField)
    throw new Error(
      `Relation key '${join.foreignField}' must be retained unchanged by the native child plan; declare .related() before transforming the join field`,
    );
  return { parentScope: parent.scope, ...join };
}

export function assertReadOnlyStages(stages: readonly PipelineStage[]): void {
  function walk(value: unknown): void {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "$out" || key === "$merge")
        throw new Error("Read plans cannot contain $out or $merge");
      walk(child);
    }
  }
  walk(stages);
}

abstract class PlanBase<Row extends object, Context = unknown> {
  declare readonly __rootPlan: true;
  declare readonly __row: Row;
  declare readonly __context: (context: Context) => void;
  constructor(readonly state: PlanState) {}

  /** Establish association before changing the child payload. */
  related<
    const Needs extends readonly Key<Row>[],
    const Fields extends SchemaFields,
  >(
    options: BatchRelationOptions<Row, Needs, Fields, Context>,
  ): AppRelationPlan<Row, SchemaRow<Fields>, Context>;
  related<
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    source: MongoSource<Child, Context>,
    join: JoinFields<Row, Child, Local, Foreign>,
  ): MongoRelationPlan<Row, Child, Context>;
  related<
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    source: AppSource<Child, Context>,
    join: JoinFields<Row, Child, Local, Foreign>,
  ): AppRelationPlan<Row, Child, Context>;
  related<
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    source: ReadSource<Child, Context>,
    join: JoinFields<Row, Child, Local, Foreign>,
  ):
    | MongoRelationPlan<Row, Child, Context>
    | AppRelationPlan<Row, Child, Context>;
  related<Child extends object>(
    source:
      | ReadSource<Child, Context>
      | BatchRelationOptions<Row, readonly Key<Row>[], SchemaFields, Context>,
    join?: { localField: string; foreignField: string },
  ):
    | MongoRelationPlan<Row, Child, Context>
    | AppRelationPlan<Row, Child, Context>
    | AppRelationPlan<Row, SchemaRow<SchemaFields>, Context> {
    if ("resolveBatch" in source)
      return batchRelation<Row, Context, readonly Key<Row>[], SchemaFields>(
        this.state,
        source,
      );
    if (!join) throw new Error("A source relation requires join fields");
    const context = relationContext(this.state, source.state, join);
    return source instanceof MongoPlan
      ? new MongoRelationPlan(
          new MongoPlan<Child, Context>(source.state),
          context,
        )
      : new AppRelationPlan(new AppPlan<Child, Context>(source.state), context);
  }

  condition(
    build: (expressions: Expressions<Row>) => MongoExpression<boolean>,
  ): Condition<Row, Context> {
    const expression = build(new Expressions<Row>());
    return new Condition(
      this.state.scope,
      expression.dependencies,
      {
        stages: [],
        test: expression.native,
        output: {},
        indexMatch: expression.optimization?.match,
      },
      expression.applicationSafe
        ? (row) => expression.evaluate(row)
        : undefined,
    );
  }

  appCondition<const Needs extends readonly Key<Row>[]>(options: {
    requires: Needs;
    evaluate: (
      row: Readonly<Pick<Row, Needs[number]>>,
      context: Context,
    ) => MaybePromise<boolean>;
  }): Condition<Row, Context> {
    return new Condition(
      this.state.scope,
      new Set(options.requires),
      undefined,
      (row, context) =>
        options.evaluate(
          pick(row, options.requires) as Pick<Row, Needs[number]>,
          context as Context,
        ),
    );
  }

  /** Preparation enriches parents; the complete Boolean tree decides membership. */
  pipelineCondition<
    const Needs extends readonly Key<Row>[],
    const Fields extends SchemaFields,
  >(options: {
    requires: Needs;
    stages: readonly PipelineStage[];
    output: ObjectSchema<Fields>;
    preservesRows: true;
    test: (
      expressions: Expressions<Row & SchemaRow<Fields>>,
    ) => MongoExpression<boolean>;
  }): Condition<Row, Context> {
    assertReadOnlyStages(options.stages);
    const additions = new Set(Object.keys(options.output.fields));
    for (const key of additions)
      if (this.state.materializedKeys.has(key))
        throw new Error(`Predicate preparation cannot overwrite '${key}'`);
    for (const stage of options.stages) {
      const entries = Object.entries(stage);
      if (entries.length !== 1)
        throw new Error("A preparation stage needs one operator");
      const [operator, payload] = entries[0];
      const writes =
        operator === "$lookup"
          ? [(payload as { as: string }).as]
          : operator === "$set" || operator === "$addFields"
            ? Object.keys(payload as object)
            : undefined;
      if (!writes || writes.some((key) => !additions.has(key))) {
        throw new Error(
          "Predicate preparation may only $lookup/$set/$addFields its declared new fields; it cannot filter or replace parents",
        );
      }
    }
    const expression = options.test(new Expressions<Row & SchemaRow<Fields>>());
    const required = new Set<string>(options.requires);
    for (const key of expression.dependencies)
      if (!additions.has(key)) required.add(key);
    return new Condition(this.state.scope, required, {
      stages: options.stages,
      test: expression.native,
      output: options.output.fields,
    });
  }

  one<
    R extends ResourceLike,
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    resource: CompatibleResource<R, NoInfer<Child>>,
    options: JoinOptions<Row, R, Child, Local, Foreign, Context>,
  ): RelationBinding<Row, R, false, Context> {
    return this.relation(resource, false, options);
  }

  many<
    R extends ResourceLike,
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    resource: CompatibleResource<R, NoInfer<Child>>,
    options: JoinOptions<Row, R, Child, Local, Foreign, Context>,
  ): RelationBinding<Row, R, true, Context> {
    return this.relation(resource, true, options);
  }

  private relation<
    R extends ResourceLike,
    Child extends object,
    Many extends boolean,
  >(
    resource: R,
    many: Many,
    options: Omit<ReaderOptions<R, Child, Context>, "source"> & {
      plan: ReadSource<Child, Context>;
      localField: string;
      foreignField: string;
    },
  ): RelationBinding<Row, R, Many, Context> {
    relationContext(this.state, options.plan.state, options);
    const { plan, localField, foreignField, ...rest } = options;
    return new RelationBinding(
      resource,
      many,
      this.state.scope,
      localField,
      foreignField,
      { ...rest, source: plan } as unknown as RuntimeReaderOptions,
    );
  }
}

export function pick(row: DataRow, keys: readonly string[]): DataRow {
  const output: DataRow = {};
  for (const key of keys) output[key] = row[key];
  return output;
}

function appendNativeStage(
  state: PlanState,
  stage: PipelineStage,
  operation: NativeOperation,
): Pick<PlanState, "stages" | "nativeOperations"> {
  return {
    stages: [...state.stages, stage],
    nativeOperations: new Map(state.nativeOperations).set(stage, operation),
  };
}

export class MongoPlan<Row extends object, Context = unknown> extends PlanBase<
  Row,
  Context
> {
  declare readonly __phase: "mongodb";
  derive<const Name extends string, Value>(
    name: Name,
    build: (expressions: Expressions<Row>) => MongoExpression<Value>,
  ): MongoPlan<Replace<Row, Name, Value>, Context> {
    assertReadKey(name);
    const expression = build(new Expressions<Row>());
    const keys = new Set(this.state.nativeKeys).add(name);
    const origins = new Map(this.state.nativeOrigins);
    origins.delete(name);
    const validators = new Map(this.state.validators);
    if (expression.output) validators.set(name, expression.output);
    else validators.delete(name);
    const eagerValidators = new Set(
      this.state.eagerValidators ?? this.state.validators.keys(),
    );
    eagerValidators.delete(name);
    return new MongoPlan({
      ...this.state,
      ...appendNativeStage(
        this.state,
        { $set: { [name]: expression.native } },
        {
          kind: "derive",
          key: name,
          requires: expression.dependencies,
          output: expression.output,
        },
      ),
      nativeKeys: keys,
      materializedKeys: keys,
      nativeOrigins: origins,
      validators,
      eagerValidators,
    });
  }

  where(
    build: (expressions: Expressions<Row>) => MongoExpression<boolean>,
  ): MongoPlan<Row, Context> {
    const expression = build(new Expressions<Row>());
    return new MongoPlan({
      ...this.state,
      ...appendNativeStage(
        this.state,
        {
          $match: {
            ...expression.optimization?.match,
            $expr: expression.native,
          },
        } as PipelineStage,
        {
          kind: "consume",
          requires: expression.dependencies,
        },
      ),
    });
  }

  sortBy(order: Partial<Record<Key<Row>, 1 | -1>>): MongoPlan<Row, Context> {
    return new MongoPlan({
      ...this.state,
      ...appendNativeStage(
        this.state,
        { $sort: order as Record<string, 1 | -1> },
        {
          kind: "consume",
          requires: new Set(Object.keys(order)),
        },
      ),
    });
  }

  project<const Keys extends readonly Key<Row>[]>(
    keys: Keys,
  ): MongoPlan<Pick<Row, Keys[number]>, Context> {
    if (!keys.length)
      throw new Error("A native projection requires at least one field");
    keys.forEach(assertReadKey);
    const projection: Record<string, 0 | 1> = Object.fromEntries(
      keys.map((key) => [key, 1]),
    );
    if (!(keys as readonly string[]).includes("_id")) projection._id = 0;
    return new MongoPlan({
      ...this.state,
      ...appendNativeStage(
        this.state,
        { $project: projection },
        {
          kind: "project",
          keys: new Set(keys),
        },
      ),
      nativeKeys: new Set(keys),
      materializedKeys: new Set(keys),
      nativeOrigins: new Map(
        [...this.state.nativeOrigins].filter(([key]) =>
          (keys as readonly string[]).includes(key),
        ),
      ),
      validators: new Map(
        [...this.state.validators].filter(([key]) =>
          (keys as readonly string[]).includes(key),
        ),
      ),
      eagerValidators: new Set(
        [
          ...(this.state.eagerValidators ?? this.state.validators.keys()),
        ].filter((key) => (keys as readonly string[]).includes(key)),
      ),
    });
  }

  /** Optional fields retain their input row; output types come from the schema. */
  native<
    const Fields extends SchemaFields,
    const Needs extends readonly Key<Row>[],
    const Provides extends readonly string[],
  >(
    options: NativeProducerOptions<Row, Fields, Needs, Provides>,
  ): MongoPlan<WithFields<Row, Fields>, Context>;
  /** Without provides/requires, the pipeline remains an unconditional transform. */
  native<const Fields extends SchemaFields>(
    options: NativeTransformOptions<Row, Fields>,
  ): MongoPlan<SchemaRow<Fields>, Context>;
  native<const Fields extends SchemaFields>(options: {
    stages: readonly PipelineStage[];
    output: ObjectSchema<Fields>;
    preserves?: readonly (Key<Row> & keyof Fields)[];
    provides?: readonly string[];
    requires?: readonly string[];
  }):
    | MongoPlan<SchemaRow<Fields>, Context>
    | MongoPlan<WithFields<Row, Fields>, Context> {
    assertReadOnlyStages(options.stages);
    if (options.provides !== undefined || options.requires !== undefined) {
      if (
        !Array.isArray(options.provides) ||
        !options.provides.length ||
        !Array.isArray(options.requires)
      )
        throw new Error(
          "A native field producer requires nonempty provides and an explicit requires array",
        );
      if (options.preserves !== undefined)
        throw new Error(
          "Native field producers preserve undeclared fields automatically; do not specify preserves",
        );
      options.provides.forEach(assertReadKey);
      options.requires.forEach(assertReadKey);
      const provides = new Set(options.provides);
      const fields = Object.keys(options.output.fields);
      if (
        provides.size !== options.provides.length ||
        provides.size !== fields.length ||
        fields.some((key) => !provides.has(key))
      )
        throw new Error(
          "Native producer provides must name every output field exactly once",
        );
      for (const key of options.requires)
        if (!this.state.materializedKeys.has(key))
          throw new Error(
            `Native producer requires unknown input field '${key}'`,
          );
      // Keep the block atomic even when several outputs are used independently.
      // Clone stage identities so reused stage objects cannot alias another block.
      const stages = options.stages.map(
        (stage) => ({ ...stage }) as PipelineStage,
      );
      const producer: NativeFieldProducer = {
        provides,
        requires: new Set(options.requires),
        stages,
        output: new Map(Object.entries(options.output.fields)),
      };
      const operations = new Map(this.state.nativeOperations);
      // An empty block may still assert/validate existing values on demand.
      const trackedStages: PipelineStage[] = stages.length
        ? stages
        : [{ $set: {} }];
      trackedStages.forEach((stage) =>
        operations.set(stage, { kind: "producer", producer }),
      );
      const keys = new Set([...this.state.nativeKeys, ...provides]);
      const origins = new Map(this.state.nativeOrigins);
      const validators = new Map(this.state.validators);
      const eagerValidators = new Set(
        this.state.eagerValidators ?? this.state.validators.keys(),
      );
      for (const [key, parser] of producer.output) {
        origins.delete(key);
        validators.set(key, parser);
        eagerValidators.delete(key);
      }
      return new MongoPlan<WithFields<Row, Fields>, Context>({
        ...this.state,
        stages: [...this.state.stages, ...trackedStages],
        nativeOperations: operations,
        nativeKeys: keys,
        materializedKeys: keys,
        nativeOrigins: origins,
        validators,
        eagerValidators,
      });
    }
    const origins = new Map(
      [...this.state.nativeOrigins].filter(([key]) =>
        options.preserves?.includes(key as never),
      ),
    );
    return new MongoPlan({
      ...this.state,
      stages: [...this.state.stages, ...options.stages],
      nativeKeys: new Set(Object.keys(options.output.fields)),
      materializedKeys: new Set(Object.keys(options.output.fields)),
      nativeOrigins: origins,
      validators: new Map(Object.entries(options.output.fields)),
      eagerValidators: new Set(Object.keys(options.output.fields)),
    });
  }

  use<Output extends object>(
    fragment: (plan: MongoPlan<Row, Context>) => MongoPlan<Output, Context>,
  ): MongoPlan<Output, Context> {
    const result = fragment(this);
    if (result.state.scope !== this.state.scope)
      throw new Error("A fragment cannot switch collections");
    return result;
  }

  toApp(
    options: { batchSize?: number; concurrency?: number } = {},
  ): AppPlan<Row, Context> {
    const batchSize = options.batchSize ?? this.state.batchSize;
    const concurrency = options.concurrency ?? this.state.concurrency;
    if (
      ![batchSize, concurrency].every(
        (value) => Number.isSafeInteger(value) && value > 0 && value <= 10_000,
      )
    )
      throw new Error(
        "Batch size and concurrency must be positive integers up to 10000",
      );
    return new AppPlan({ ...this.state, batchSize, concurrency });
  }
}

export class AppPlan<Row extends object, Context = unknown> extends PlanBase<
  Row,
  Context
> {
  declare readonly __phase: "application";
  load<
    const Name extends string,
    Dependency extends RelationDependency<Row, unknown, Context>,
  >(
    name: Name,
    dependency: Dependency,
  ): AppPlan<Replace<Row, Name, Dependency["__value"]>, Context> {
    assertReadKey(name);
    if (
      !(dependency instanceof RelationDependency) ||
      dependency.binding.parentScope !== this.state.scope
    )
      throw new Error("A relation dependency must belong to the same source");
    const nativeKeys = new Set(this.state.nativeKeys);
    nativeKeys.delete(name);
    const nativeOrigins = new Map(this.state.nativeOrigins);
    nativeOrigins.delete(name);
    return new AppPlan({
      ...this.state,
      nativeKeys,
      nativeOrigins,
      application: [
        ...this.state.application,
        {
          kind: "load",
          key: name,
          requires: dependency.binding.requires,
          dependency: dependency as unknown as RelationDependency<
            object,
            unknown
          >,
        },
      ],
    });
  }

  derive<
    const Name extends string,
    const Needs extends readonly Key<Row>[],
    Value,
  >(
    name: Name,
    requires: Needs,
    resolve: (
      row: Readonly<Pick<Row, Needs[number]>>,
      context: Context,
    ) => MaybePromise<Value>,
  ): AppPlan<Replace<Row, Name, Awaited<Value>>, Context> {
    assertReadKey(name);
    const nativeKeys = new Set(this.state.nativeKeys);
    nativeKeys.delete(name);
    const nativeOrigins = new Map(this.state.nativeOrigins);
    nativeOrigins.delete(name);
    return new AppPlan({
      ...this.state,
      nativeKeys,
      nativeOrigins,
      application: [
        ...this.state.application,
        {
          kind: "derive",
          key: name,
          requires,
          run: (row, context) =>
            resolve(
              pick(row, requires) as Pick<Row, Needs[number]>,
              context as Context,
            ),
        },
      ],
    });
  }

  map<Output extends object>(
    resolve: (row: Readonly<Row>, context: Context) => MaybePromise<Output>,
  ): AppPlan<Output, Context> {
    return new AppPlan({
      ...this.state,
      nativeKeys: new Set(),
      nativeOrigins: new Map(),
      application: [
        ...this.state.application,
        {
          kind: "map",
          run: (row, context) => resolve(row as Row, context as Context),
        },
      ],
    });
  }

  filter(
    predicate: (row: Readonly<Row>, context: Context) => MaybePromise<boolean>,
  ): AppPlan<Row, Context> {
    return new AppPlan({
      ...this.state,
      application: [
        ...this.state.application,
        {
          kind: "filter",
          run: (row, context) => predicate(row as Row, context as Context),
        },
      ],
    });
  }

  transformBatch<Output extends object>(
    resolve: (
      rows: readonly Readonly<Row>[],
      context: Context,
    ) => MaybePromise<readonly Output[]>,
  ): AppPlan<Output, Context> {
    return new AppPlan({
      ...this.state,
      nativeKeys: new Set(),
      nativeOrigins: new Map(),
      application: [
        ...this.state.application,
        {
          kind: "batch",
          run: (rows, context) =>
            resolve(rows as unknown as readonly Row[], context as Context),
        },
      ],
    });
  }

  use<Output extends object>(
    fragment: (plan: AppPlan<Row, Context>) => AppPlan<Output, Context>,
  ): AppPlan<Output, Context> {
    const result = fragment(this);
    if (result.state.scope !== this.state.scope)
      throw new Error("A fragment cannot switch collections");
    return result;
  }
}

export type ReadPlan<Row extends object, Context = unknown> =
  | MongoPlan<Row, Context>
  | AppPlan<Row, Context>;
export type PlanRow<P> = P extends { readonly __row: infer Row } ? Row : never;
export type PlanContext<P> = P extends {
  readonly __context: (context: infer Context) => void;
}
  ? Context
  : never;

type ResourceBindingOptions<
  R extends ResourceLike,
  Row extends object,
  Context = unknown,
> = Omit<ReaderOptions<R, Row, Context>, "source">;
type ResourceBindingArguments<
  R extends ResourceLike,
  Row extends object,
  Context = unknown,
> =
  {} extends ResourceBindingOptions<R, Row, Context>
    ? [options?: ResourceBindingOptions<R, Row, Context>]
    : [options: ResourceBindingOptions<R, Row, Context>];

/** The join belongs to this context, independently of its transformed payload. */
abstract class RelationPlanBase<
  Parent extends object,
  Row extends object,
  Context = unknown,
> {
  declare readonly __row: Row;
  declare readonly __context: (context: Context) => void;
  constructor(
    protected readonly plan: ReadPlan<Row, Context>,
    protected readonly correlation: RelationContext,
  ) {}

  get state(): PlanState {
    return this.plan.state;
  }

  one<R extends ResourceLike>(
    resource: CompatibleResource<R, Row>,
    ...[options]: ResourceBindingArguments<R, Row, Context>
  ): RelationBinding<Parent, R, false, Context> {
    return this.bind(resource, false, options);
  }

  many<R extends ResourceLike>(
    resource: CompatibleResource<R, Row>,
    ...[options]: ResourceBindingArguments<R, Row, Context>
  ): RelationBinding<Parent, R, true, Context> {
    return this.bind(resource, true, options);
  }

  private bind<R extends ResourceLike, Many extends boolean>(
    resource: R,
    many: Many,
    options?: ResourceBindingOptions<R, Row, Context>,
  ): RelationBinding<Parent, R, Many, Context> {
    return new RelationBinding(
      resource,
      many,
      this.correlation.parentScope,
      this.correlation.localField,
      this.correlation.foreignField,
      { ...options, source: this.plan } as unknown as RuntimeReaderOptions,
    );
  }

  condition(
    build: (expressions: Expressions<Row>) => MongoExpression<boolean>,
  ): Condition<Row, Context> {
    return this.plan.condition(build);
  }

  appCondition<const Needs extends readonly Key<Row>[]>(options: {
    requires: Needs;
    evaluate: (
      row: Readonly<Pick<Row, Needs[number]>>,
      context: Context,
    ) => MaybePromise<boolean>;
  }): Condition<Row, Context> {
    return this.plan.appCondition(options);
  }

  pipelineCondition<
    const Needs extends readonly Key<Row>[],
    const Fields extends SchemaFields,
  >(options: {
    requires: Needs;
    stages: readonly PipelineStage[];
    output: ObjectSchema<Fields>;
    preservesRows: true;
    test: (
      expressions: Expressions<Row & SchemaRow<Fields>>,
    ) => MongoExpression<boolean>;
  }): Condition<Row, Context> {
    return this.plan.pipelineCondition(options);
  }

  related<
    const Needs extends readonly Key<Row>[],
    const Fields extends SchemaFields,
  >(
    options: BatchRelationOptions<Row, Needs, Fields, Context>,
  ): AppRelationPlan<Row, SchemaRow<Fields>, Context>;
  related<
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    source: MongoSource<Child, Context>,
    join: JoinFields<Row, Child, Local, Foreign>,
  ): MongoRelationPlan<Row, Child, Context>;
  related<
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    source: AppSource<Child, Context>,
    join: JoinFields<Row, Child, Local, Foreign>,
  ): AppRelationPlan<Row, Child, Context>;
  related<
    Child extends object,
    const Local extends Key<Row>,
    const Foreign extends Key<Child>,
  >(
    source: ReadSource<Child, Context>,
    join: JoinFields<Row, Child, Local, Foreign>,
  ):
    | MongoRelationPlan<Row, Child, Context>
    | AppRelationPlan<Row, Child, Context>;
  related<Child extends object>(
    source:
      | ReadSource<Child, Context>
      | BatchRelationOptions<Row, readonly Key<Row>[], SchemaFields, Context>,
    join?: { localField: string; foreignField: string },
  ):
    | MongoRelationPlan<Row, Child, Context>
    | AppRelationPlan<Row, Child, Context>
    | AppRelationPlan<Row, SchemaRow<SchemaFields>, Context> {
    if ("resolveBatch" in source)
      return batchRelation<Row, Context, readonly Key<Row>[], SchemaFields>(
        this.state,
        source,
      );
    if (!join) throw new Error("A source relation requires join fields");
    return this.plan.related(
      source,
      join as JoinFields<Row, Child, Key<Row>, Key<Child>>,
    );
  }

  protected assertSameContext<Output extends object>(
    other: RelationPlanBase<Parent, Output, Context>,
  ): void {
    if (
      other.correlation !== this.correlation ||
      other.state.scope !== this.state.scope
    )
      throw new Error(
        "A relation fragment cannot switch its source or parent context",
      );
  }
}

/** Native stages operate on the rows already matched to one parent. */
export class MongoRelationPlan<
  Parent extends object,
  Row extends object,
  Context = unknown,
> extends RelationPlanBase<Parent, Row, Context> {
  constructor(
    private readonly nativePlan: MongoPlan<Row, Context>,
    context: RelationContext,
  ) {
    super(nativePlan, context);
  }

  derive<const Name extends string, Value>(
    name: Name,
    build: (expressions: Expressions<Row>) => MongoExpression<Value>,
  ): MongoRelationPlan<Parent, Replace<Row, Name, Value>, Context> {
    return new MongoRelationPlan(
      this.nativePlan.derive(name, build),
      this.correlation,
    );
  }

  where(
    build: (expressions: Expressions<Row>) => MongoExpression<boolean>,
  ): MongoRelationPlan<Parent, Row, Context> {
    return new MongoRelationPlan(
      this.nativePlan.where(build),
      this.correlation,
    );
  }

  sortBy(
    order: Partial<Record<Key<Row>, 1 | -1>>,
  ): MongoRelationPlan<Parent, Row, Context> {
    return new MongoRelationPlan(
      this.nativePlan.sortBy(order),
      this.correlation,
    );
  }

  project<const Keys extends readonly Key<Row>[]>(
    keys: Keys,
  ): MongoRelationPlan<Parent, Pick<Row, Keys[number]>, Context> {
    return new MongoRelationPlan(
      this.nativePlan.project(keys),
      this.correlation,
    );
  }

  native<
    const Fields extends SchemaFields,
    const Needs extends readonly Key<Row>[],
    const Provides extends readonly string[],
  >(
    options: NativeProducerOptions<Row, Fields, Needs, Provides>,
  ): MongoRelationPlan<Parent, WithFields<Row, Fields>, Context>;
  native<const Fields extends SchemaFields>(
    options: Omit<NativeTransformOptions<Row, Fields>, "preserves">,
  ): MongoRelationPlan<Parent, SchemaRow<Fields>, Context>;
  native<const Fields extends SchemaFields>(options: {
    stages: readonly PipelineStage[];
    output: ObjectSchema<Fields>;
    provides?: readonly string[];
    requires?: readonly Key<Row>[];
  }):
    | MongoRelationPlan<Parent, SchemaRow<Fields>, Context>
    | MongoRelationPlan<Parent, WithFields<Row, Fields>, Context> {
    if (options.provides !== undefined)
      return new MongoRelationPlan(
        this.nativePlan.native(
          options as NativeProducerOptions<
            Row,
            Fields,
            readonly Key<Row>[],
            readonly string[]
          >,
        ),
        this.correlation,
      );
    return new MongoRelationPlan(
      this.nativePlan.native(options as NativeTransformOptions<Row, Fields>),
      this.correlation,
    );
  }

  toApp(
    options: { batchSize?: number; concurrency?: number } = {},
  ): AppRelationPlan<Parent, Row, Context> {
    return new AppRelationPlan(
      this.nativePlan.toApp(options),
      this.correlation,
    );
  }

  use<Output extends object>(
    fragment: (
      plan: MongoRelationPlan<Parent, Row, Context>,
    ) => MongoRelationPlan<Parent, Output, Context>,
  ): MongoRelationPlan<Parent, Output, Context> {
    const result = fragment(this);
    this.assertSameContext(result);
    return result;
  }
}

/** Application callbacks run inside one parent's relation, including batch callbacks. */
export class AppRelationPlan<
  Parent extends object,
  Row extends object,
  Context = unknown,
> extends RelationPlanBase<Parent, Row, Context> {
  constructor(
    private readonly appPlan: AppPlan<Row, Context>,
    context: RelationContext,
  ) {
    super(appPlan, context);
  }

  load<
    const Name extends string,
    Dependency extends RelationDependency<Row, unknown, Context>,
  >(
    name: Name,
    dependency: Dependency,
  ): AppRelationPlan<
    Parent,
    Replace<Row, Name, Dependency["__value"]>,
    Context
  > {
    return new AppRelationPlan(
      this.appPlan.load(name, dependency),
      this.correlation,
    );
  }

  derive<
    const Name extends string,
    const Needs extends readonly Key<Row>[],
    Value,
  >(
    name: Name,
    requires: Needs,
    resolve: (
      row: Readonly<Pick<Row, Needs[number]>>,
      context: Context,
    ) => MaybePromise<Value>,
  ): AppRelationPlan<Parent, Replace<Row, Name, Awaited<Value>>, Context> {
    return new AppRelationPlan(
      this.appPlan.derive(name, requires, resolve),
      this.correlation,
    );
  }

  map<Output extends object>(
    resolve: (row: Readonly<Row>, context: Context) => MaybePromise<Output>,
  ): AppRelationPlan<Parent, Output, Context> {
    return new AppRelationPlan(this.appPlan.map(resolve), this.correlation);
  }

  filter(
    predicate: (row: Readonly<Row>, context: Context) => MaybePromise<boolean>,
  ): AppRelationPlan<Parent, Row, Context> {
    return new AppRelationPlan(
      this.appPlan.filter(predicate),
      this.correlation,
    );
  }

  transformBatch<Output extends object>(
    resolve: (
      rows: readonly Readonly<Row>[],
      context: Context,
    ) => MaybePromise<readonly Output[]>,
  ): AppRelationPlan<Parent, Output, Context> {
    return new AppRelationPlan(
      this.appPlan.transformBatch(resolve),
      this.correlation,
    );
  }

  use<Output extends object>(
    fragment: (
      plan: AppRelationPlan<Parent, Row, Context>,
    ) => AppRelationPlan<Parent, Output, Context>,
  ): AppRelationPlan<Parent, Output, Context> {
    const result = fragment(this);
    this.assertSameContext(result);
    return result;
  }
}

export interface MongoSourceOptions<Row extends object, Context = unknown> {
  /** Required input policy: evaluated before any native stage, at roots and in relations. */
  scope?: (
    expressions: Expressions<Row>,
    context: Context,
  ) => MongoExpression<boolean>;
}

// Infer from a covariant raw-document return rather than Mongoose's many model
// generics, which can otherwise widen Model<Row & Document> to `any`.
type SourceModel<Row extends object> = Pick<Model<Row>, "castObject"> &
  Pick<Model<unknown>, "aggregate" | "collection" | "db"> & {
    readonly schema: { readonly paths: Readonly<Record<string, unknown>> };
  };
type SourceRow<Row extends object> = Row extends Document
  ? Omit<Row, Exclude<keyof Document, "_id">>
  : Row;

export function createMongo<Context = unknown>(requiresContext = false) {
  return {
    from<Row extends object>(
      model: SourceModel<Row>,
      options: MongoSourceOptions<SourceRow<Row>, Context> = {},
    ): MongoPlan<SourceRow<Row>, Context> {
      const keys = Object.keys(model.schema.paths).map(
        (path) => path.split(".")[0],
      );
      keys.forEach(assertReadKey);
      const adapter: CollectionAdapter = {
        name: model.collection.name,
        database: model.db,
        async *scan(pipeline, batchSize) {
          const cursor = model
            .aggregate<DataRow>(pipeline)
            .cursor({ batchSize });
          try {
            for await (const row of cursor) yield row;
          } finally {
            await cursor.close();
          }
        },
      };
      const scope = {};
      return new MongoPlan({
        scope,
        requiresContext,
        collection: adapter,
        stages: [],
        inputScope: options.scope
          ? (context) => {
              const expression = options.scope!(
                new Expressions<SourceRow<Row>>(),
                context as Context,
              );
              // Retain predicate metadata without evaluating the policy twice.
              return new Condition(scope, expression.dependencies, {
                stages: [],
                test: expression.native,
                output: {},
                indexMatch: expression.optimization?.match,
              });
            }
          : undefined,
        nativeKeys: new Set(keys),
        materializedKeys: new Set(keys),
        nativeOrigins: new Map(keys.map((key) => [key, key])),
        validators: new Map(),
        application: [],
        batchSize: 256,
        concurrency: 1,
      });
    },
  };
}

export const mongo = createMongo();
