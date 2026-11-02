import { Types, type PipelineStage } from "mongoose";
import { isDeepStrictEqual } from "node:util";
import {
  defaultReadLimits,
  ExactReadQuery,
  ExecutedRead,
  ParsedReadQuery,
  parseReadQuery,
  ReadData,
  ReadExecutor,
  ReadLimits,
  ReadPlanInspection,
  ReadQuery,
  ReadValidationError,
  readRecord,
  ResourceLike,
  schema,
  ValueSchema,
  WhereNode,
} from "@n/adira.core.ts";
import { DataRow, scalarExpression } from "./expression";
import { andMatch, IndexMatch, orMatch } from "./index-match";
import {
  nativePageSplit,
  nativeUnits,
  readsRowShape,
  repeatableMongo,
  rowLocalWrites,
} from "./native-effects";
import {
  ApplicationStage,
  BatchParentRef,
  Condition,
  CompatibleResource,
  createMongo,
  NativeFieldProducer,
  pick,
  PlanState,
  ReaderOptions,
  RelationBinding,
  RelationDependency,
  RuntimeReaderOptions,
} from "./plan";

export class ReadBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadBudgetError";
  }
}

interface Definition {
  resource: ResourceLike;
  options: RuntimeReaderOptions;
  state: PlanState;
  limits: ReadLimits;
  relations: Record<
    string,
    {
      binding: RelationBinding<object, ResourceLike, boolean>;
      child: Definition;
    }
  >;
}
interface Atom {
  condition: Condition<object>;
  flag?: string;
  check?: {
    key: string;
    fields: Readonly<Record<string, ValueSchema<unknown>>>;
  };
}
type FilterTree =
  | { kind: "atom"; atom: Atom }
  | { kind: "and" | "or"; children: FilterTree[] }
  | { kind: "not"; child: FilterTree };
interface RelationTask {
  field: string;
  binding: RelationBinding<object, ResourceLike, boolean>;
  child: Compiled;
  alias?: string;
}
interface DependencyTask {
  dependency: RelationDependency<object, unknown>;
  relation: RelationTask;
  strategy: "mongodb" | "application";
  reason?: string;
  pipeline: PipelineStage[];
  /** Preferred native body; runtime key guards retain the parent-scoped fallback. */
  bulk?: PipelineStage[];
  reduction?: { accumulator: unknown; checks: readonly unknown[] };
  fusionReason?: string;
}
type LoadStage = Extract<ApplicationStage, { kind: "load" }>;
interface ReductionGroup {
  stages: LoadStage[];
  tasks: DependencyTask[];
  pipeline: PipelineStage[];
  phase: "membership" | "output";
  columns: { value: string; invalid?: string }[];
}
interface Compiled {
  definition: Definition;
  query: ParsedReadQuery;
  pipeline: PipelineStage[];
  tree: FilterTree;
  atoms: Atom[];
  application: ApplicationStage[];
  outputApplication: ApplicationStage[];
  loads: Map<ApplicationStage, DependencyTask>;
  complete: boolean;
  nativePagination: boolean;
  nativeOrder: boolean;
  order: Record<string, 1 | -1>;
  relations: RelationTask[];
  validators: ReadonlyMap<string, ValueSchema<unknown>>;
  bulkBarrier?: string;
  inputPipeline: PipelineStage[];
  reductionGroups: ReductionGroup[];
}
interface Envelope {
  data: DataRow;
  truth: Map<Atom, boolean>;
  joined: Map<RelationTask, unknown[]>;
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function definition(
  resource: ResourceLike,
  options: RuntimeReaderOptions,
  ancestors: ReadonlySet<RuntimeReaderOptions> = new Set(),
): Definition {
  if (ancestors.has(options))
    throw new Error("Cyclic relation definitions are not supported");
  const path = new Set(ancestors).add(options);
  const limits = { ...defaultReadLimits, ...options.limits };
  if (options.limits?.defaultLimit === undefined)
    limits.defaultLimit = Math.min(limits.defaultLimit, limits.maxLimit);
  if (
    !Object.values(limits).every(
      (value) => Number.isSafeInteger(value) && value > 0,
    ) ||
    limits.defaultLimit > limits.maxLimit
  ) {
    throw new Error(
      "Read limits must be positive integers and defaultLimit must not exceed maxLimit",
    );
  }
  const result: Definition = {
    resource,
    options,
    state: options.source.state,
    limits,
    relations: {},
  };
  for (const [name, binding] of Object.entries(options.relations ?? {})) {
    const field = resource.fields[name];
    if (!field || field.kind !== "relation")
      throw new Error(`Unknown relation binding '${name}'`);
    if (
      binding.parentScope !== result.state.scope ||
      binding.resource !== field.resource ||
      binding.many !== field.many
    ) {
      throw new Error(
        `Relation '${name}' has an incompatible source, resource, or cardinality`,
      );
    }
    result.relations[name] = {
      binding,
      child: definition(field.resource, binding.options, path),
    };
  }
  for (const [name, field] of Object.entries(resource.fields)) {
    if (field.kind === "relation" && !hasOwn(result.relations, name))
      throw new Error(`Missing relation implementation '${name}'`);
  }
  for (const [name, handlers] of Object.entries(options.filters ?? {})) {
    const field = resource.predicates[name] ?? resource.fields[name];
    if (!field || field.kind !== "scalar")
      throw new Error(`Unknown filter implementation '${name}'`);
    for (const [operator, handler] of Object.entries(handlers)) {
      if (
        !field.operators.includes(operator as never) ||
        typeof handler !== "function"
      )
        throw new Error(`Invalid implementation '${name}.${operator}'`);
    }
  }
  for (const [name, field] of Object.entries(resource.predicates)) {
    for (const operator of field.operators)
      if (typeof options.filters?.[name]?.[operator] !== "function") {
        throw new Error(`Missing filter implementation '${name}.${operator}'`);
      }
  }
  for (const [name, direction] of Object.entries(
    options.defaultOrderBy ?? {},
  )) {
    const field = resource.fields[name];
    if (
      !field ||
      field.kind !== "scalar" ||
      !field.sortable ||
      !["asc", "desc"].includes(direction)
    )
      throw new Error(`Invalid default ordering '${name}'`);
  }
  return result;
}

const literal = (value: boolean): unknown => ({ $literal: value });
function exactNative(
  tree: FilterTree,
  resolve: (atom: Atom) => unknown | undefined = (atom) =>
    atom.flag ? { $eq: [`$${atom.flag}`, true] } : undefined,
): unknown | undefined {
  if (tree.kind === "atom") return resolve(tree.atom);
  if (tree.kind === "not") {
    const child = exactNative(tree.child, resolve);
    return child === undefined ? undefined : { $not: [child] };
  }
  const children = tree.children.map((child) => exactNative(child, resolve));
  if (children.some((child) => child === undefined)) return undefined;
  return { [tree.kind === "and" ? "$and" : "$or"]: children };
}

/** A conservative necessary condition; unknown negated subtrees stay in the app. */
function necessaryNative(tree: FilterTree): unknown {
  const exact = exactNative(tree);
  if (exact !== undefined) return exact;
  if (tree.kind === "atom" || tree.kind === "not") return literal(true);
  return {
    [tree.kind === "and" ? "$and" : "$or"]: tree.children.map(necessaryNative),
  };
}

/** Undefined is an unrestricted necessary condition. Negation requires exactness. */
function earlyNecessary(
  tree: FilterTree,
  resolve: (atom: Atom) => unknown | undefined,
): unknown | undefined {
  const exact = exactNative(tree, resolve);
  if (exact !== undefined) return exact;
  if (tree.kind === "atom" || tree.kind === "not") return undefined;
  const children = tree.children.map((child) => earlyNecessary(child, resolve));
  if (tree.kind === "or" && children.some((child) => child === undefined))
    return undefined;
  const known = children.filter((child) => child !== undefined);
  if (!known.length) return undefined;
  if (known.length === 1) return known[0];
  return { [tree.kind === "and" ? "$and" : "$or"]: known };
}

/** Index matches are supersets; no approximation may be negated. */
function necessaryIndex(
  tree: FilterTree,
  resolve: (atom: Atom) => IndexMatch | undefined,
): IndexMatch | undefined {
  if (tree.kind === "atom") return resolve(tree.atom);
  if (tree.kind === "not") return undefined;
  const children = tree.children.map((child) => necessaryIndex(child, resolve));
  return tree.kind === "and" ? andMatch(children) : orMatch(children);
}

/** Add necessary filters at safe boundaries; keep the original exact filter intact. */
function pushNativePredicates(
  state: PlanState,
  stages: readonly PipelineStage[],
  tree: FilterTree,
  atoms: readonly Atom[],
): PipelineStage[] {
  // Native predicate preparations follow the source prefix. Crossing an opaque
  // preparation or nonrepeatable predicate would also change its input stream.
  for (const { flag, condition } of atoms)
    if (
      flag &&
      condition.native &&
      (!repeatableMongo(condition.native.test) ||
        rowLocalWrites(condition.native.stages) === undefined)
    )
      return [...stages];

  const units = nativeUnits(state, stages);
  const positions = new Map<Atom, number>();
  const boundaries = new Set<number>();
  const hasPreparation = atoms.some(
    (atom) => atom.flag && atom.condition.native?.stages.length,
  );
  for (const entry of atoms) {
    if (!entry.flag || entry.condition.native?.stages.length) continue;
    let position = units.length;
    for (let index = units.length - 1; index >= 0; index--) {
      const unit = units[index];
      const writes = unit.writes;
      if (
        !writes ||
        [...entry.condition.requires].some(
          (key) => writes.has(key) || (unit.keeps && !unit.keeps.has(key)),
        )
      )
        break;
      position = index;
    }
    positions.set(entry, position);
    if (
      position < units.length ||
      hasPreparation ||
      entry.condition.native?.indexMatch
    )
      boundaries.add(position);
  }
  const output: PipelineStage[] = [];
  for (let index = 0; index <= units.length; index++) {
    if (boundaries.has(index)) {
      const indexMatch = necessaryIndex(tree, (atom) => {
        const position = positions.get(atom);
        return position !== undefined && position <= index
          ? atom.condition.native?.indexMatch
          : undefined;
      });
      const test = earlyNecessary(tree, (atom) => {
        const position = positions.get(atom);
        return position !== undefined && position <= index
          ? atom.condition.native!.test
          : undefined;
      });
      if (test !== undefined)
        output.push({
          $match: { ...indexMatch, $expr: test },
        } as PipelineStage);
    }
    if (index < units.length) output.push(...units[index].stages);
  }
  return output;
}

function requiredApplication(
  state: PlanState,
  early: Set<string>,
  late: Set<string>,
): {
  stages: ApplicationStage[];
  outputStages: ApplicationStage[];
  columns: Set<string>;
} {
  const stages: ApplicationStage[] = [];
  const outputStages: ApplicationStage[] = [];
  let all = false;
  for (const stage of [...state.application].reverse()) {
    if (stage.kind === "derive" || stage.kind === "load") {
      if (all || early.has(stage.key)) {
        stages.unshift(stage);
        early.delete(stage.key);
        late.delete(stage.key);
        stage.requires.forEach((key) => early.add(key));
      } else if (late.has(stage.key)) {
        outputStages.unshift(stage);
        late.delete(stage.key);
        stage.requires.forEach((key) => late.add(key));
      }
    } else {
      // Opaque callbacks can observe every earlier column and derived value.
      stages.unshift(stage);
      all = true;
    }
  }
  const columns = new Set([...early, ...late]);
  if (all) state.materializedKeys.forEach((key) => columns.add(key));
  for (const key of state.eagerValidators ?? state.validators.keys())
    columns.add(key);
  // Keep the original sequence: a delayed callback must not observe a value
  // overwritten by a later early stage. Only a suffix can move past pagination.
  const enabled = new Set([...stages, ...outputStages]);
  const earlyStages = new Set(stages);
  const boundary = state.application.reduce(
    (last, stage, index) => (earlyStages.has(stage) ? index : last),
    -1,
  );
  return {
    stages: state.application.filter(
      (stage, index) => enabled.has(stage) && index <= boundary,
    ),
    outputStages: state.application.filter(
      (stage, index) => enabled.has(stage) && index > boundary,
    ),
    columns,
  };
}

/** Backward liveness preserves stage order and resolves overwritten field versions. */
function requiredNative(
  state: PlanState,
  required: ReadonlySet<string>,
): { stages: PipelineStage[]; validated: Set<string> } {
  let live = new Set(required);
  let all = false;
  const stages: PipelineStage[] = [];
  const validated = new Set<string>();
  const producers = new Set<NativeFieldProducer>();
  for (const stage of [...state.stages].reverse()) {
    const operation = state.nativeOperations?.get(stage);
    if (operation?.kind === "producer") {
      const { producer } = operation;
      if (producers.has(producer)) continue;
      producers.add(producer);
      if (!all && ![...producer.provides].some((key) => live.has(key)))
        continue;
      for (const [key, parser] of producer.output)
        if (state.validators.get(key) === parser) validated.add(key);
      if (!all) {
        producer.provides.forEach((key) => live.delete(key));
        producer.requires.forEach((key) => live.add(key));
      }
      stages.push(...[...producer.stages].reverse());
      continue;
    } else if (operation?.kind === "derive") {
      if (!all && !live.has(operation.key)) continue;
      if (
        operation.output &&
        state.validators.get(operation.key) === operation.output
      )
        validated.add(operation.key);
      if (!all) {
        live.delete(operation.key);
        operation.requires.forEach((key) => live.add(key));
      }
    } else if (operation?.kind === "consume") {
      operation.requires.forEach((key) => live.add(key));
    } else if (operation?.kind === "project") {
      live = new Set(
        all
          ? operation.keys
          : [...live].filter((key) => operation.keys.has(key)),
      );
      all = false;
    } else {
      // Raw stages may inspect $$ROOT, change membership, order, or cardinality.
      // Keeping the block also keeps the complete input it could observe.
      all = true;
    }
    stages.push(stage);
  }
  return { stages: stages.reverse(), validated };
}

function parsedQuery(
  def: Definition,
  input: unknown,
  allowEmpty = false,
): ParsedReadQuery {
  return parseReadQuery(
    def.resource,
    input,
    def.limits,
    (path) => {
      let provider = def;
      for (const key of path) provider = provider.relations[key].child;
      return provider.limits;
    },
    { allowEmptyRootSelection: allowEmpty },
  );
}

function completeQuery(
  def: Definition,
  input: unknown,
  allowEmpty = false,
  operation = "all",
): ParsedReadQuery {
  const parsed = parsedQuery(def, input, allowEmpty);
  function check(value: unknown): void {
    const query = readRecord(value, `${operation}() query`);
    if (hasOwn(query, "page"))
      throw new ReadValidationError(
        `${operation}() does not accept pagination, including nested relations`,
      );
    for (const selection of Object.values(readRecord(query.select, "select")))
      if (selection !== true && selection !== undefined) check(selection);
  }
  check(input);
  return parsed;
}

function dependencyQuery(
  def: Definition,
  dependency: RelationDependency<object, unknown>,
): ParsedReadQuery {
  const { operation, field } = dependency;
  const options = readRecord(dependency.query, `${operation}() query`);
  const row = ["all", "first", "last", "get"].includes(operation);
  const numeric = ["sum", "avg", "min", "max"].includes(operation);
  const allowed = row
    ? operation === "get"
      ? ["select", "where"]
      : ["select", "where", "orderBy"]
    : numeric
      ? ["field", "where"]
      : ["where"];
  for (const key of Object.keys(options))
    if (key === "page")
      throw new ReadValidationError(
        `${operation}() does not accept pagination, including nested relations`,
      );
    else if (!allowed.includes(key))
      throw new ReadValidationError(`${operation}(): unsupported key '${key}'`);
  if (numeric) {
    const definition =
      typeof field === "string" && hasOwn(def.resource.fields, field)
        ? def.resource.fields[field]
        : undefined;
    if (
      !definition ||
      definition.kind !== "scalar" ||
      options.field !== field ||
      (definition.value.native && definition.value.native.type !== "number")
    )
      throw new ReadValidationError(
        `${operation}() requires a numeric scalar field`,
      );
  }
  const query = completeQuery(
    def,
    row
      ? options
      : {
          select: field ? { [field]: true } : {},
          where: options.where,
        },
    !row && !field,
    operation,
  );
  if (operation === "first" || operation === "last") {
    if (!Object.keys(query.orderBy).length)
      throw new ReadValidationError(
        `${operation}() requires a non-empty orderBy`,
      );
    if (
      def.state.nativeOrigins.get("_id") === "_id" &&
      !hasOwn(query.orderBy, "_id")
    )
      query.orderBy._id = 1;
    if (operation === "last")
      query.orderBy = Object.fromEntries(
        Object.entries(query.orderBy).map(([key, direction]) => [
          key,
          direction === 1 ? -1 : 1,
        ]),
      );
  }
  return query;
}

/** A native check must have exactly the same acceptance semantics as its parser. */
function nativeValidation(
  parser: ValueSchema<unknown>,
  value: unknown,
): unknown | undefined {
  const description = parser.native;
  if (!description) return undefined;
  const type = { $type: value };
  let valid: unknown;
  if (description.type === "number") {
    valid = {
      $and: [
        { $in: [type, ["double", "int", "long"]] },
        { $gte: [value, -Number.MAX_VALUE] },
        { $lte: [value, Number.MAX_VALUE] },
        {
          $or: [
            { $ne: [type, "long"] },
            {
              $and: [
                { $gte: [value, -Number.MAX_SAFE_INTEGER] },
                { $lte: [value, Number.MAX_SAFE_INTEGER] },
              ],
            },
          ],
        },
      ],
    };
  } else if (description.type === "enum") {
    valid = {
      $and: [
        { $eq: [type, "string"] },
        { $in: [value, { $literal: description.values ?? [] }] },
      ],
    };
  } else {
    valid = { $eq: [type, description.type === "boolean" ? "bool" : "string"] };
  }
  return description.nullable
    ? { $or: [{ $eq: [{ $ifNull: [value, null] }, null] }, valid] }
    : valid;
}

/** Only known row-local operations may share a child stream across parents. */
function bulkReductionBarrier(
  state: PlanState,
  stages: readonly PipelineStage[],
  input: readonly PipelineStage[],
  atoms: readonly Atom[],
): string | undefined {
  if (input.some((stage) => !repeatableMongo(stage) || readsRowShape(stage)))
    return "The input policy needs parent-scoped execution";
  for (const stage of stages) {
    const operation = state.nativeOperations?.get(stage);
    if (
      !operation ||
      operation.kind === "producer" ||
      !(
        (operation.kind === "derive" && "$set" in stage) ||
        (operation.kind === "consume" &&
          ("$match" in stage || "$sort" in stage)) ||
        (operation.kind === "project" && "$project" in stage)
      )
    )
      return "Opaque native child stages retain parent-scoped execution";
    if (!repeatableMongo(stage) || readsRowShape(stage))
      return "A child expression needs parent-scoped execution";
  }
  for (const atom of atoms) {
    const native = atom.condition.native;
    if (
      !native ||
      native.stages.length ||
      !repeatableMongo(native.test) ||
      readsRowShape(native.test)
    )
      return "Custom predicate preparation retains parent-scoped execution";
  }
  return undefined;
}

const bulkKeys = "__adira_bulk_keys";

function dependencyStrategy(
  dependency: RelationDependency<object, unknown>,
  child: Compiled,
): Pick<
  DependencyTask,
  "strategy" | "reason" | "pipeline" | "bulk" | "reduction"
> {
  const { operation, field } = dependency;
  const fallback = (reason: string) => ({
    strategy: "application" as const,
    reason,
    pipeline: child.pipeline,
  });
  if (operation === "all")
    return fallback(
      "Complete child rows are materialized through batched reads",
    );
  if (child.definition.state.provider)
    return fallback("Child candidates are supplied by resolveBatch");
  if (exactNative(child.tree) === undefined || child.application.length)
    return fallback("Child membership or ordering requires application work");
  const row = ["first", "last", "get"].includes(operation);
  if (row) {
    if (!child.nativeOrder)
      return fallback("Child ordering requires application work");
    return {
      strategy: "mongodb",
      pipeline: [...child.pipeline, { $limit: operation === "get" ? 2 : 1 }],
    };
  }
  if (child.outputApplication.length)
    return fallback("The aggregate field requires application work");
  const checks: unknown[] = [];
  function check(parser: ValueSchema<unknown>, path: string): boolean {
    const expression = nativeValidation(parser, `$${path}`);
    if (expression === undefined) return false;
    checks.push(expression);
    return true;
  }
  for (const [key, parser] of child.validators)
    if (!check(parser, key))
      return fallback("A custom source validator requires application work");
  for (const atom of child.atoms)
    if (atom.check)
      for (const [key, parser] of Object.entries(atom.check.fields))
        if (!check(parser, `${atom.check.key}.${key}`))
          return fallback(
            "Custom predicate validation requires application work",
          );
  if (field) {
    const descriptor = child.definition.resource.fields[field];
    if (descriptor.kind !== "scalar" || !check(descriptor.value, field))
      return fallback("The aggregate field needs a custom parser");
  }
  const valid = { $and: checks };
  const pipeline = [...child.pipeline];
  if (operation === "exists") {
    pipeline.push(
      { $limit: 1 },
      {
        $project: {
          _id: 0,
          value: { $literal: true },
          invalid: { $cond: [valid, 0, 1] },
        },
      },
    );
  } else {
    const accumulator =
      operation === "count"
        ? { $sum: 1 }
        : {
            [`$${operation}`]: {
              $cond: [
                { $eq: [{ $ifNull: [`$${field}`, null] }, null] },
                "$$REMOVE",
                `$${field}`,
              ],
            },
          };
    pipeline.push({
      $group: {
        _id: null,
        value: accumulator,
        invalid: { $sum: { $cond: [valid, 0, 1] } },
      },
    } as PipelineStage);
  }
  if (["count", "sum", "avg", "min", "max"].includes(operation)) {
    if (child.bulkBarrier)
      return { strategy: "mongodb", pipeline, reason: child.bulkBarrier };
    // Preserve original correlation through managed projections and overwritten
    // public join fields. No arbitrary pipeline is rewritten here.
    const bulk = child.pipeline.map((stage) =>
      "$project" in stage
        ? { $project: { ...stage.$project, [bulkKeys]: 1 } }
        : stage,
    );
    const reduction = pipeline[pipeline.length - 1] as PipelineStage.Group;
    bulk.push(
      { $unwind: `$${bulkKeys}` },
      { $group: { ...reduction.$group, _id: `$${bulkKeys}` } },
    );
    return {
      strategy: "mongodb",
      pipeline,
      bulk,
      reduction: { accumulator: (reduction.$group as DataRow).value, checks },
    };
  }
  return { strategy: "mongodb", pipeline };
}

function nativeJoinKeys(value: unknown): unknown {
  return {
    $filter: {
      input: { $cond: [{ $isArray: value }, value, [value]] },
      cond: { $ne: [{ $ifNull: ["$$this", null] }, null] },
    },
  };
}

function compile(
  def: Definition,
  query: ParsedReadQuery,
  context: unknown,
  mode: {
    page?: boolean;
    lookups?: boolean;
    complete?: boolean;
    loading?: ReadonlySet<RelationDependency<object, unknown>>;
    /** Recompile a union selection without invoking user policy/filter factories again. */
    reuse?: Compiled;
  } = {},
): Compiled {
  if (!mode.complete && !query.one && query.limit > def.limits.maxLimit)
    throw new ReadValidationError(
      `page.limit exceeds the provider's maximum (${def.limits.maxLimit})`,
    );
  const state = def.state;
  const policy = mode.reuse ? undefined : state.inputScope?.(context);
  const nativePolicy = policy instanceof Condition ? policy.native : undefined;
  const inputPipeline: PipelineStage[] =
    mode.reuse?.inputPipeline ??
    (state.inputScope
      ? [
          {
            $match: {
              ...nativePolicy?.indexMatch,
              $expr: nativePolicy ? nativePolicy.test : policy,
            },
          } as PipelineStage,
        ]
      : []);
  let reusedAtom = 0;
  const pipeline: PipelineStage[] = [];
  const atoms: Atom[] = [];
  function atom(condition: Condition<object>): FilterTree {
    if (!(condition instanceof Condition) || condition.scope !== state.scope)
      throw new Error("Filter implementation belongs to a different source");
    const entry: Atom = { condition };
    const native =
      !state.provider &&
      condition.native &&
      !state.application.some((stage) => stage.kind === "batch") &&
      [...condition.requires].every((key) => state.nativeKeys.has(key));
    if (native && condition.native) {
      const prefix = `__adira_pred_${atoms.length}`;
      entry.flag = prefix;
      pipeline.push(...condition.native.stages);
      const outputs = Object.keys(condition.native.output);
      const values: DataRow = { [prefix]: condition.native.test };
      if (outputs.length) {
        const key = `${prefix}_check`;
        entry.check = { key, fields: condition.native.output };
        values[key] = Object.fromEntries(
          outputs.map((output) => [output, `$${output}`]),
        );
      }
      pipeline.push({ $set: values });
      if (outputs.length) pipeline.push({ $unset: outputs });
    } else if (!condition.evaluate) {
      throw new Error(
        "This native predicate depends on application-produced fields; provide an application implementation",
      );
    }
    atoms.push(entry);
    return { kind: "atom", atom: entry };
  }
  function where(node: WhereNode): FilterTree {
    if (node.kind === "atom") {
      if (mode.reuse) return atom(mode.reuse.atoms[reusedAtom++].condition);
      const custom = def.options.filters?.[node.field]?.[node.operator];
      if (custom) return atom(custom(node.value));
      const expression = scalarExpression(
        node.field,
        node.operator,
        node.value,
      );
      return atom(
        new Condition(
          state.scope,
          expression.dependencies,
          {
            stages: [],
            test: expression.native,
            output: {},
            indexMatch: expression.optimization?.match,
          },
          (row) => expression.evaluate(row),
        ),
      );
    }
    if (node.kind === "not") return { kind: "not", child: where(node.child) };
    return { kind: node.kind, children: node.children.map(where) };
  }
  const scope = def.options.scope
    ? atom(
        mode.reuse
          ? mode.reuse.atoms[reusedAtom++].condition
          : def.options.scope(context),
      )
    : undefined;
  const nativeScope = scope && exactNative(scope);
  if (nativeScope !== undefined)
    pipeline.push({ $match: { $expr: nativeScope } } as PipelineStage);
  const root = where(query.where);
  const tree: FilterTree = scope
    ? { kind: "and", children: [scope, root] }
    : root;
  const nativeFilter = exactNative(tree);
  pipeline.push({
    $match: { $expr: nativeFilter ?? necessaryNative(tree) },
  } as PipelineStage);
  const order = Object.keys(query.orderBy).length
    ? query.orderBy
    : (Object.fromEntries(
        Object.entries(def.options.defaultOrderBy ?? {}).map(
          ([key, direction]) => [key, direction === "asc" ? 1 : -1],
        ),
      ) as Record<string, 1 | -1>);
  const nativeOrder = Object.keys(order).every((key) =>
    state.nativeKeys.has(key),
  );
  if (nativeOrder && Object.keys(order).length) pipeline.push({ $sort: order });
  const changesMembership = state.application.some(
    (stage) => stage.kind === "filter" || stage.kind === "batch",
  );
  const nativePagination =
    !state.provider &&
    !mode.complete &&
    mode.page !== false &&
    nativeFilter !== undefined &&
    nativeOrder &&
    !changesMembership;
  if (nativePagination) {
    if (query.offset) pipeline.push({ $skip: query.offset });
    pipeline.push({ $limit: query.limit });
  }
  const pageBoundary = pipeline.length;

  const relations: RelationTask[] = [];
  for (const [name, selection] of Object.entries(query.select)) {
    if (selection === true) continue;
    const configured = def.relations[name];
    const canLookup =
      !state.provider &&
      !configured.child.state.provider &&
      configured.binding.localField !== undefined &&
      configured.binding.foreignField !== undefined &&
      mode.lookups !== false &&
      nativePagination &&
      state.nativeKeys.has(configured.binding.localField) &&
      state.collection.database === configured.child.state.collection.database;
    const child = compile(configured.child, selection, context, {
      complete: mode.complete,
      loading: mode.loading,
    });
    const task: RelationTask = { field: name, ...configured, child };
    if (canLookup && child.nativePagination) {
      task.alias = `__adira_relation_${relations.length}`;
      const keys = `${task.alias}_keys`;
      const hasKeys = { $gt: [{ $size: `$${keys}` }, 0] };
      pipeline.push({
        $set: { [keys]: nativeJoinKeys(`$${task.binding.localField}`) },
      });
      pipeline.push({
        $lookup: {
          from: child.definition.state.collection.name,
          localField: keys,
          foreignField: task.binding.foreignField,
          let: {
            adiraHasKey: hasKeys,
          },
          pipeline: [
            { $match: { $expr: "$$adiraHasKey" } },
            ...child.pipeline,
          ] as PipelineStage.Lookup["$lookup"]["pipeline"],
          as: task.alias,
        },
      });
      // A custom $facet can emit a row even after matching an empty stream.
      // Missing relation keys always mean no related result, in either strategy.
      pipeline.push({
        $set: { [task.alias]: { $cond: [hasKeys, `$${task.alias}`, []] } },
      });
      pipeline.push({ $unset: keys });
    }
    relations.push(task);
  }

  const late = new Set(
    Object.entries(query.select)
      .filter(([, selection]) => selection === true)
      .map(([key]) => key),
  );
  const early = new Set<string>();
  for (const entry of atoms)
    if (!entry.flag) entry.condition.requires.forEach((key) => early.add(key));
  Object.keys(order).forEach((key) => early.add(key));
  relations.forEach((task) =>
    task.binding.requires.forEach((key) => late.add(key)),
  );
  const application = requiredApplication(state, early, late);
  const nativeRequired = new Set(application.columns);
  for (const entry of atoms)
    if (entry.flag)
      entry.condition.requires.forEach((key) => nativeRequired.add(key));
  if (nativeOrder) Object.keys(order).forEach((key) => nativeRequired.add(key));
  const native = requiredNative(state, nativeRequired);
  const validators = new Map(
    [...state.validators].filter(
      ([key]) => nativeRequired.has(key) || native.validated.has(key),
    ),
  );
  const pageInputs = new Set(Object.keys(order));
  const predicateWrites = new Set<string>();
  let canDefer = nativePagination;
  for (const entry of atoms) {
    entry.condition.requires.forEach((key) => pageInputs.add(key));
    const condition = entry.condition.native;
    const writes = condition && rowLocalWrites(condition.stages);
    if (
      !condition ||
      !repeatableMongo(condition.test) ||
      !writes ||
      readsRowShape(condition.test) ||
      condition.stages.some(readsRowShape)
    ) {
      canDefer = false;
    } else {
      writes.forEach((key) => predicateWrites.add(key));
    }
  }
  const scheduled = canDefer
    ? nativePageSplit(state, native.stages, pageInputs, predicateWrites)
    : { before: native.stages, after: [] };
  // Enrich selected parents before native includes and the final projection.
  // Application membership/order keeps its original complete native prefix.
  pipeline.splice(pageBoundary, 0, ...scheduled.after);
  pipeline.unshift(
    ...inputPipeline,
    ...pushNativePredicates(state, scheduled.before, tree, atoms),
  );
  const loads = new Map<ApplicationStage, DependencyTask>();
  for (const stage of [...application.stages, ...application.outputStages]) {
    if (stage.kind !== "load") continue;
    if (mode.loading?.has(stage.dependency))
      throw new Error(`Cyclic relation dependency '${stage.key}'`);
    const { binding } = stage.dependency;
    if (
      binding.parentScope !== state.scope ||
      binding.many !== (stage.dependency.operation !== "get")
    )
      throw new Error(`Invalid relation dependency '${stage.key}'`);
    let child = definition(binding.resource, binding.options);
    if (!["all", "first", "last"].includes(stage.dependency.operation))
      child = { ...child, options: { ...child.options, defaultOrderBy: {} } };
    const compiled = compile(
      child,
      dependencyQuery(child, stage.dependency),
      context,
      {
        page: false,
        lookups: false,
        complete: true,
        loading: new Set(mode.loading).add(stage.dependency),
      },
    );
    const relation: RelationTask = {
      field: stage.key,
      binding,
      child: compiled,
    };
    loads.set(stage, {
      dependency: stage.dependency,
      relation,
      ...dependencyStrategy(stage.dependency, compiled),
    });
  }
  const projection: Record<string, 0 | 1> = {};
  for (const key of application.columns)
    if (state.materializedKeys.has(key)) projection[key] = 1;
  for (const key of validators.keys()) projection[key] = 1;
  for (const entry of atoms) {
    if (entry.flag) projection[entry.flag] = 1;
    if (entry.check) projection[entry.check.key] = 1;
  }
  for (const task of relations) if (task.alias) projection[task.alias] = 1;
  if (!projection._id) projection._id = 0;
  // At least one inclusion avoids turning an empty mask into an exclusion query.
  if (Object.values(projection).some((value) => value === 1))
    pipeline.push({ $project: projection });
  const compiled: Compiled = {
    definition: def,
    query,
    pipeline: state.provider ? [] : pipeline,
    tree,
    atoms,
    application: application.stages,
    outputApplication: application.outputStages,
    loads,
    complete: mode.complete ?? false,
    nativePagination,
    nativeOrder,
    order,
    relations,
    validators,
    inputPipeline,
    reductionGroups: [],
    bulkBarrier: bulkReductionBarrier(
      state,
      native.stages,
      inputPipeline,
      atoms,
    ),
  };
  compiled.reductionGroups = [
    ...fuseReductions(application.stages, loads, context, "membership"),
    ...fuseReductions(application.outputStages, loads, context, "output"),
  ];
  return compiled;
}

/** Membership facts are captured per compilation, including context-dependent policies. */
function sameReductionInput(a: DependencyTask, b: DependencyTask): boolean {
  const x = a.relation.child,
    y = b.relation.child;
  return (
    a.relation.binding === b.relation.binding &&
    isDeepStrictEqual(x.query.where, y.query.where) &&
    isDeepStrictEqual(x.inputPipeline, y.inputPipeline) &&
    isDeepStrictEqual(
      x.atoms.map((atom) => atom.condition.native),
      y.atoms.map((atom) => atom.condition.native),
    )
  );
}

function fuseReductions(
  stages: readonly ApplicationStage[],
  loads: Map<ApplicationStage, DependencyTask>,
  context: unknown,
  phase: ReductionGroup["phase"],
): ReductionGroup[] {
  const groups: ReductionGroup[] = [];
  let run: LoadStage[] = [];
  function flush() {
    const members = run;
    run = [];
    if (members.length < 2) {
      for (const stage of members)
        loads.get(stage)!.fusionReason ??=
          "No compatible adjacent reduction in the same execution phase";
      return;
    }
    const tasks = members.map((stage) => loads.get(stage)!);
    const first = tasks[0].relation.child;
    const select: ParsedReadQuery["select"] = Object.fromEntries(
      tasks.flatMap((task) =>
        task.dependency.field ? [[task.dependency.field, true as const]] : [],
      ),
    );
    // These are managed, row-local native streams. A union selection retains
    // each operation's required derivations, projections and field versions.
    const child = compile(
      first.definition,
      { ...first.query, select },
      context,
      {
        page: false,
        lookups: false,
        complete: true,
        reuse: first,
      },
    );
    const compatible =
      !child.bulkBarrier &&
      !child.application.length &&
      !child.outputApplication.length &&
      exactNative(child.tree) !== undefined &&
      tasks.every((task) =>
        [...task.relation.child.validators].every(
          ([key, parser]) =>
            child.validators.has(key) &&
            isDeepStrictEqual(
              nativeValidation(parser, `$${key}`),
              nativeValidation(child.validators.get(key)!, `$${key}`),
            ),
        ),
      );
    if (!compatible) {
      for (const task of tasks)
        task.fusionReason =
          "The union selection cannot preserve every native input and validator";
      return;
    }
    const group: DataRow = { _id: `$${bulkKeys}` };
    const checks: unknown[][] = [];
    const columns = tasks.map((task, index) => {
      const value = `__adira_reduction_${index}`;
      group[value] = task.reduction!.accumulator;
      const unique = task.reduction!.checks.filter(
        (check, i, all) =>
          all.findIndex((other) => isDeepStrictEqual(other, check)) === i,
      );
      if (!unique.length) return { value };
      let checkIndex = checks.findIndex((other) =>
        isDeepStrictEqual(other, unique),
      );
      if (checkIndex < 0) {
        checkIndex = checks.length;
        checks.push(unique);
      }
      const invalid = `__adira_reduction_invalid_${checkIndex}`;
      group[invalid] = { $sum: { $cond: [{ $and: unique }, 0, 1] } };
      return { value, invalid };
    });
    const pipeline: PipelineStage[] = child.pipeline.map((stage) =>
      "$project" in stage
        ? { $project: { ...stage.$project, [bulkKeys]: 1 } }
        : stage,
    );
    pipeline.push({ $unwind: `$${bulkKeys}` }, {
      $group: group,
    } as PipelineStage.Group);
    groups.push({ stages: members, tasks, columns, pipeline, phase });
  }
  for (const stage of stages) {
    const task = stage.kind === "load" ? loads.get(stage)! : undefined;
    if (stage.kind !== "load" || !task?.bulk || !task.reduction) {
      flush();
      if (task)
        task.fusionReason =
          task.reason ??
          "Only eligible bulk count/sum/avg/min/max reductions can fuse";
      continue;
    }
    if (
      run.length &&
      (!sameReductionInput(loads.get(run[0])!, task) ||
        run.some(
          (previous) =>
            stage.requires.includes(previous.key) || previous.key === stage.key,
        ))
    ) {
      flush();
      task.fusionReason =
        "Relation, membership, policy or parent inputs differ from the preceding reduction";
    }
    run.push(stage);
  }
  flush();
  return groups;
}

function envelope(raw: DataRow, compiled: Compiled): Envelope {
  const data = { ...raw };
  const truth = new Map<Atom, boolean>();
  for (const entry of compiled.atoms) {
    if (entry.flag) {
      const value = raw[entry.flag];
      if (typeof value !== "boolean")
        throw new ReadValidationError(
          "A native predicate did not return a boolean",
        );
      truth.set(entry, value);
    }
    if (entry.check) {
      const snapshot = readRecord(raw[entry.check.key], "predicate output");
      for (const [key, parser] of Object.entries(entry.check.fields))
        parser.parse(snapshot[key]);
    }
  }
  const joined = new Map<RelationTask, unknown[]>();
  for (const task of compiled.relations)
    if (task.alias) {
      const value = raw[task.alias];
      if (!Array.isArray(value))
        throw new ReadValidationError(
          `Relation '${task.field}' did not return an array`,
        );
      joined.set(task, value);
    }
  for (const key of Object.keys(data))
    if (key.startsWith("__adira_")) delete data[key];
  for (const [key, parser] of compiled.validators) {
    data[key] = parser.parse(data[key]);
  }
  return { data, truth, joined };
}

async function boundedMap<Input, Output>(
  items: readonly Input[],
  concurrency: number,
  run: (item: Input) => Promise<Output>,
): Promise<Output[]> {
  const output: Output[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(items.length, concurrency) }, async () => {
      while (next < items.length) {
        const index = next++;
        output[index] = await run(items[index]);
      }
    }),
  );
  return output;
}

async function application(
  rows: Envelope[],
  compiled: Compiled,
  context: unknown,
  stages = compiled.application,
): Promise<Envelope[]> {
  let output = rows;
  const completed = new Set<ApplicationStage>();
  for (const stage of stages) {
    if (completed.has(stage)) continue;
    if (stage.kind === "load") {
      const group = compiled.reductionGroups.find(
        (candidate) => candidate.stages[0] === stage,
      );
      const fused =
        group &&
        (await materializeBulkValues(
          output,
          group.tasks[0].relation,
          group.pipeline,
          () =>
            group.tasks.map((task) =>
              emptyDependencyValue(task.dependency.operation),
            ),
          (raw) =>
            group.tasks.map((task, index) =>
              nativeDependencyValue(
                {
                  value: raw[group.columns[index].value],
                  invalid: group.columns[index].invalid
                    ? raw[group.columns[index].invalid!]
                    : 0,
                },
                task.dependency.operation,
              ),
            ),
        ));
      if (fused) {
        output = output.map((row, index) => ({
          ...row,
          data: {
            ...row.data,
            ...Object.fromEntries(
              group.stages.map((member, i) => [member.key, fused[index][i]]),
            ),
          },
        }));
        group.stages.forEach((member) => completed.add(member));
        continue;
      }
      const values = await materializeDependency(
        output,
        compiled.loads.get(stage)!,
        context,
        compiled.definition.state.concurrency,
      );
      output = output.map((row, index) => ({
        ...row,
        data: { ...row.data, [stage.key]: values[index] },
      }));
    } else if (stage.kind === "batch") {
      const transformed = await stage.run(
        output.map((item) => item.data),
        context,
      );
      if (!Array.isArray(transformed))
        throw new ReadValidationError(
          "A batch transformation must return an array",
        );
      if (transformed.length > compiled.definition.limits.maxCandidates)
        throw new ReadBudgetError(
          "Batch transformation exceeded maxCandidates",
        );
      output = transformed.map((row) => ({
        data: readRecord(row, "application row"),
        truth: new Map(),
        joined: new Map(),
      }));
    } else {
      const mapped = await boundedMap(
        output,
        compiled.definition.state.concurrency,
        async (item) => {
          if (stage.kind === "derive")
            return {
              ...item,
              data: {
                ...item.data,
                [stage.key]: await stage.run(item.data, context),
              },
            };
          if (stage.kind === "map")
            return {
              ...item,
              data: readRecord(
                await stage.run(item.data, context),
                "application row",
              ),
            };
          const matches = await stage.run(item.data, context);
          if (typeof matches !== "boolean")
            throw new ReadValidationError(
              "An application filter must return a boolean",
            );
          return matches ? item : undefined;
        },
      );
      output = mapped.filter((item): item is Envelope => item !== undefined);
    }
  }
  return output;
}

async function matches(
  tree: FilterTree,
  item: Envelope,
  context: unknown,
): Promise<boolean> {
  if (tree.kind === "atom") {
    if (tree.atom.flag) return item.truth.get(tree.atom) === true;
    const value = await tree.atom.condition.evaluate!(item.data, context);
    if (typeof value !== "boolean")
      throw new ReadValidationError(
        "An application predicate must return a boolean",
      );
    return value;
  }
  if (tree.kind === "not") return !(await matches(tree.child, item, context));
  for (const child of tree.children) {
    const value = await matches(child, item, context);
    if (tree.kind === "and" && !value) return false;
    if (tree.kind === "or" && value) return true;
  }
  return tree.kind === "and";
}

function compare(
  left: Envelope,
  right: Envelope,
  order: Record<string, 1 | -1>,
): number {
  for (const [key, direction] of Object.entries(order)) {
    const a = left.data[key] ?? null,
      b = right.data[key] ?? null;
    if (a === b) continue;
    if (a === null) return -direction;
    if (b === null) return direction;
    if (typeof a !== typeof b)
      throw new ReadValidationError(
        `Inconsistent values for sort field '${key}'`,
      );
    const difference =
      typeof a === "string" && typeof b === "string"
        ? Buffer.compare(Buffer.from(a), Buffer.from(b))
        : a < b
          ? -1
          : 1;
    if (difference) return difference * direction;
  }
  return 0;
}

async function selectRows(
  input: AsyncIterable<DataRow> | Iterable<DataRow>,
  compiled: Compiled,
  context: unknown,
): Promise<Envelope[]> {
  let output: Envelope[] = [];
  let seen = 0,
    passed = 0;
  let pending: Envelope[] = [];
  const { maxCandidates } = compiled.definition.limits;
  async function finish(): Promise<Envelope[]> {
    const result: Envelope[] = [];
    const size = compiled.definition.state.batchSize;
    for (let offset = 0; offset < output.length; offset += size)
      result.push(
        ...(await application(
          output.slice(offset, offset + size),
          compiled,
          context,
          compiled.outputApplication,
        )),
      );
    return result;
  }
  async function consume(): Promise<boolean> {
    const transformed = await application(pending, compiled, context);
    pending = [];
    for (const item of transformed) {
      if (!(await matches(compiled.tree, item, context))) continue;
      if (
        compiled.complete ||
        compiled.nativePagination ||
        !compiled.nativeOrder
      )
        output.push(item);
      else if (passed++ >= compiled.query.offset) output.push(item);
      if (
        !compiled.complete &&
        compiled.nativeOrder &&
        output.length >= compiled.query.limit
      )
        return true;
      if (output.length > maxCandidates && !compiled.nativePagination)
        throw new ReadBudgetError("Application results exceeded maxCandidates");
    }
    return false;
  }
  for await (const row of input) {
    if (!compiled.nativePagination && ++seen > maxCandidates)
      throw new ReadBudgetError(
        `Read exceeded maxCandidates (${maxCandidates}); no partial page was returned`,
      );
    pending.push(envelope(row, compiled));
    if (
      pending.length >=
      Math.min(compiled.definition.state.batchSize, maxCandidates)
    ) {
      if (await consume()) return finish();
    }
  }
  if (pending.length) await consume();
  if (!compiled.nativeOrder) {
    output.sort((left, right) => compare(left, right, compiled.order));
    if (!compiled.complete)
      output = output.slice(
        compiled.query.offset,
        compiled.query.offset + compiled.query.limit,
      );
  }
  return finish();
}

function keyOf(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    "toHexString" in value &&
    typeof value.toHexString === "function"
  )
    return `id:${value.toHexString()}`;
  if (typeof value === "string") return `s:${value}`;
  if (typeof value === "number" || typeof value === "boolean")
    return `${typeof value}:${String(value)}`;
  throw new ReadValidationError(
    "Relation keys must be strings, numbers, booleans, or ObjectIds",
  );
}
function localKeys(value: unknown): unknown[] {
  return value == null
    ? []
    : Array.isArray(value)
      ? value.filter((key) => key != null)
      : [value];
}

function emptyDependencyValue(operation: string): unknown {
  return operation === "count" || operation === "sum"
    ? 0
    : operation === "exists"
      ? false
      : null;
}

function reduceDependency(
  values: DataRow[],
  dependency: RelationDependency<object, unknown>,
): unknown {
  const { operation, field } = dependency;
  if (operation === "all") return values;
  if (operation === "count") return values.length;
  if (operation === "exists") return values.length > 0;
  if (operation === "get" && values.length > 1)
    throw new ReadValidationError("To-one get() returned multiple rows");
  if (["first", "last", "get"].includes(operation)) return values[0] ?? null;
  let total = 0,
    count = 0,
    average = 0,
    minimum: number | null = null,
    maximum: number | null = null;
  for (const row of values) {
    const value = row[field!];
    if (value === null) continue;
    const number = schema.number().parse(value);
    total += number;
    count++;
    // A convex update avoids overflowing a finite mean through its raw sum.
    average = average * ((count - 1) / count) + number / count;
    minimum = minimum === null ? number : Math.min(minimum, number);
    maximum = maximum === null ? number : Math.max(maximum, number);
  }
  const value =
    operation === "sum"
      ? total
      : operation === "avg"
        ? count
          ? average
          : null
        : operation === "min"
          ? minimum
          : maximum;
  return value === null ? null : schema.number().parse(value);
}

/** Keep parent identity outside the child payload throughout native execution. */
async function* relatedBatches(
  rows: Envelope[],
  task: RelationTask,
  childPipeline: PipelineStage[],
): AsyncGenerator<{ index: number; values: DataRow[] }> {
  const { child, binding } = task;
  if (binding.localField === undefined || binding.foreignField === undefined)
    throw new Error("A MongoDB relation requires join fields");
  const localField = binding.localField;
  const parents = rows.flatMap((row, index) => {
    const keys = new Map(
      localKeys(row.data[localField]).map((key) => [keyOf(key), key]),
    );
    return keys.size ? [{ index, keys: [...keys.values()] }] : [];
  });
  const size = child.definition.state.batchSize;
  for (let offset = 0; offset < parents.length; offset += size) {
    const batch = parents.slice(offset, offset + size);
    const pending = new Set(batch.map((parent) => parent.index));
    const pipeline: PipelineStage[] = [
      { $limit: 1 },
      // $facet supplies one seed even when the collection is empty. No dummy
      // documents are needed, and custom pipelines can handle an empty input.
      { $facet: { seed: [{ $project: { _id: 1 } }] } },
      { $project: { _id: 0, __adira_parent: { $literal: batch } } },
      { $unwind: "$__adira_parent" },
      {
        $lookup: {
          from: child.definition.state.collection.name,
          localField: "__adira_parent.keys",
          foreignField: binding.foreignField,
          pipeline:
            childPipeline as PipelineStage.Lookup["$lookup"]["pipeline"],
          as: "__adira_values",
        },
      },
      {
        $project: {
          _id: 0,
          parent: "$__adira_parent.index",
          values: "$__adira_values",
        },
      },
    ];
    for await (const raw of child.definition.state.collection.scan(
      pipeline,
      size,
    )) {
      const index = raw.parent;
      if (
        typeof index !== "number" ||
        !pending.delete(index) ||
        !Array.isArray(raw.values)
      )
        throw new ReadValidationError("Invalid parent-scoped relation result");
      yield {
        index,
        values: raw.values.map((value) => readRecord(value, "relation row")),
      };
    }
    if (pending.size)
      throw new ReadValidationError("Missing parent-scoped relation result");
  }
}

async function materializeDependency(
  rows: Envelope[],
  task: DependencyTask,
  context: unknown,
  concurrency: number,
): Promise<unknown[]> {
  if (task.strategy === "application")
    return (
      await materializeRelation(rows, task.relation, context, concurrency)
    ).map((values) => reduceDependency(values, task.dependency));
  const bulk = task.bulk && (await materializeBulkDependency(rows, task));
  if (bulk) return bulk;
  const { operation } = task.dependency;
  const { child } = task.relation;
  const output = rows.map(() => emptyDependencyValue(operation));
  for await (const { index, values } of relatedBatches(
    rows,
    task.relation,
    task.pipeline,
  )) {
    if (["first", "last", "get"].includes(operation)) {
      if (operation === "get" && values.length > 1)
        throw new ReadValidationError("To-one get() returned multiple rows");
      const selected = await selectRows(values, child, context);
      output[index] = (await project(selected, child, context))[0] ?? null;
    } else if (values.length) {
      if (values.length !== 1)
        throw new ReadValidationError(
          `Invalid child value in ${operation}() dependency`,
        );
      output[index] = nativeDependencyValue(values[0], operation);
    }
  }
  return output;
}

function nativeDependencyValue(row: DataRow, operation: string): unknown {
  if (row.invalid !== 0)
    throw new ReadValidationError(
      `Invalid child value in ${operation}() dependency`,
    );
  const value = row.value;
  return operation === "exists"
    ? schema.boolean().parse(value)
    : value == null && operation !== "count" && operation !== "sum"
      ? null
      : schema.number().parse(value ?? 0);
}

/** One grouped child scan per key batch, retaining all parents that share a key. */
async function materializeBulkDependency(
  rows: Envelope[],
  task: DependencyTask,
): Promise<unknown[] | undefined> {
  if (!task.bulk) return undefined;
  return materializeBulkValues(
    rows,
    task.relation,
    task.bulk,
    () => emptyDependencyValue(task.dependency.operation),
    (raw) => nativeDependencyValue(raw, task.dependency.operation),
  );
}

/** Shared correlation, scalar-key guards and empty defaults for individual/fused scans. */
async function materializeBulkValues<T>(
  rows: Envelope[],
  relation: RelationTask,
  body: PipelineStage[],
  empty: () => T,
  decode: (row: DataRow) => T,
): Promise<T[] | undefined> {
  const { binding, child } = relation;
  if (!binding.localField || !binding.foreignField) return undefined;
  const parents = new Map<string, { key: Types.ObjectId; indexes: number[] }>();
  for (const [index, row] of rows.entries()) {
    const key = row.data[binding.localField];
    if (key == null) continue;
    // Static model declarations do not prove the shape of stored BSON values.
    // Other scalar types and multikey parents keep the existing join semantics.
    if (!(key instanceof Types.ObjectId)) return undefined;
    const id = keyOf(key);
    const parent = parents.get(id);
    if (parent) parent.indexes.push(index);
    else parents.set(id, { key, indexes: [index] });
  }
  const output = rows.map(empty);
  const entries = [...parents.values()];
  const size = child.definition.state.batchSize;
  for (let offset = 0; offset < entries.length; offset += size) {
    const batch = entries.slice(offset, offset + size);
    const keys = batch.map((parent) => parent.key);
    const pending = new Map(batch.map((parent) => [keyOf(parent.key), parent]));
    const foreign = `$${binding.foreignField}`;
    const pipeline: PipelineStage[] = [
      { $match: { [binding.foreignField]: { $in: keys } } },
      {
        $set: {
          [bulkKeys]: {
            $cond: [
              { $isArray: foreign },
              // Deduplicate array membership; a child contributes once per key.
              { $setIntersection: [foreign, { $literal: keys }] },
              // Avoid an O(batch size) intersection for ordinary scalar joins.
              [foreign],
            ],
          },
        },
      },
      ...body,
    ];
    for await (const raw of child.definition.state.collection.scan(
      pipeline,
      size,
    )) {
      const parent =
        raw._id instanceof Types.ObjectId && pending.get(keyOf(raw._id));
      if (!parent)
        throw new ReadValidationError("Invalid bulk relation correlation");
      pending.delete(keyOf(raw._id));
      const value = decode(raw);
      for (const index of parent.indexes) output[index] = value;
    }
  }
  return output;
}

/** Shared by display includes and private computation dependencies. */
async function materializeRelation(
  rows: Envelope[],
  task: RelationTask,
  context: unknown,
  concurrency: number,
): Promise<DataRow[][]> {
  const provider = task.child.definition.state.provider;
  if (provider) {
    const child = task.child;
    const values: DataRow[][] = rows.map(() => []);
    const size = child.definition.state.batchSize;
    for (let offset = 0; offset < rows.length; offset += size) {
      const parents = rows.slice(offset, offset + size).map((parent) =>
        Object.freeze({
          ref: Object.freeze(Object.create(null)) as BatchParentRef,
          row: Object.freeze(pick(parent.data, provider.requires)),
        }),
      );
      const pending = new Map(
        parents.map(({ ref }, index) => [ref, offset + index]),
      );
      const result = await provider.resolveBatch({
        parents: Object.freeze(parents),
        context,
      });
      if (!Array.isArray(result))
        throw new ReadValidationError("resolveBatch must return an array");
      // Validate the complete invocation before filtering or paging any parent.
      const validated: { index: number; rows: DataRow[] }[] = [];
      for (const entry of result) {
        const item = readRecord(entry, "resolveBatch result");
        const index = pending.get(item.ref as BatchParentRef);
        if (index === undefined)
          throw new ReadValidationError(
            "resolveBatch returned a duplicate or unknown parent reference",
          );
        pending.delete(item.ref as BatchParentRef);
        if (!Array.isArray(item.rows))
          throw new ReadValidationError(
            "resolveBatch result rows must be an array",
          );
        if (item.rows.length > child.definition.limits.maxCandidates)
          throw new ReadBudgetError(
            "resolveBatch exceeded maxCandidates; no partial relation was returned",
          );
        validated.push({
          index,
          rows: item.rows.map((row) => {
            try {
              return provider.output.parse(row) as DataRow;
            } catch (error) {
              throw new ReadValidationError(
                `resolveBatch output: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }),
        });
      }
      if (pending.size)
        throw new ReadValidationError(
          "resolveBatch omitted a parent result; return rows: [] for no matches",
        );
      for (const entry of validated)
        values[entry.index] = await project(
          await selectRows(entry.rows, child, context),
          child,
          context,
        );
    }
    return values;
  }
  if (task.alias) {
    return boundedMap(rows, concurrency, async (row) => {
      const selected = await selectRows(
        (row.joined.get(task) ?? []).map((value) =>
          readRecord(value, "relation row"),
        ),
        task.child,
        context,
      );
      return project(selected, task.child, context);
    });
  } else {
    const child = task.child;
    const values: DataRow[][] = rows.map(() => []);
    const limit = child.definition.limits.maxCandidates;
    const pipeline = child.nativePagination
      ? child.pipeline
      : [...child.pipeline, { $limit: limit + 1 } as PipelineStage];
    for await (const result of relatedBatches(rows, task, pipeline)) {
      if (!child.nativePagination && result.values.length > limit)
        throw new ReadBudgetError(
          "Deferred relation exceeded maxCandidates; no partial relation was returned",
        );
      values[result.index] = await project(
        await selectRows(result.values, child, context),
        child,
        context,
      );
    }
    return values;
  }
}

async function project(
  rows: Envelope[],
  compiled: Compiled,
  context: unknown,
): Promise<DataRow[]> {
  const related = new Map<RelationTask, DataRow[][]>();
  for (const task of compiled.relations)
    related.set(
      task,
      await materializeRelation(
        rows,
        task,
        context,
        compiled.definition.state.concurrency,
      ),
    );
  return rows.map((row, index) => {
    const output: DataRow = {};
    for (const [key, selection] of Object.entries(compiled.query.select)) {
      const field = compiled.definition.resource.fields[key];
      if (selection === true && field.kind === "scalar") {
        try {
          output[key] = field.value.parse(row.data[key]);
        } catch (error) {
          throw new ReadValidationError(
            `Response field '${key}': ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else if (field.kind === "relation") {
        const task = compiled.relations.find((item) => item.field === key)!;
        const values = related.get(task)![index];
        if (field.many) output[key] = values;
        else {
          if (values.length > 1)
            throw new ReadValidationError(
              `To-one relation '${key}' returned multiple rows`,
            );
          if (!values.length && !field.allowsNull)
            throw new ReadValidationError(
              `Required relation '${key}' is missing`,
            );
          output[key] = values[0] ?? null;
        }
      }
    }
    return output;
  });
}

function inspection(compiled: Compiled): ReadPlanInspection {
  const label = (stage: ApplicationStage): string =>
    stage.kind === "derive" || stage.kind === "load"
      ? `${stage.kind} ${stage.key}`
      : stage.kind;
  const application = compiled.application.map(label);
  if (exactNative(compiled.tree) === undefined)
    application.push("evaluate Boolean filter");
  if (!compiled.nativeOrder) application.push("sort");
  if (!compiled.complete && !compiled.nativePagination)
    application.push("paginate");
  return {
    pipeline: compiled.pipeline,
    application: application.concat(compiled.outputApplication.map(label)),
    nativePagination: compiled.nativePagination,
    deferredRelations: compiled.relations
      .filter((task) => !task.alias)
      .map((task) => task.field),
    relationStrategies: Object.fromEntries(
      compiled.relations.map((task) => [
        task.field,
        task.child.definition.state.provider
          ? "resolveBatch"
          : task.alias
            ? "lookup"
            : "batched-lookup",
      ]),
    ),
    relations: Object.fromEntries(
      compiled.relations.map((task) => [task.field, inspection(task.child)]),
    ),
    dependencies: Object.fromEntries(
      Array.from(
        compiled.loads,
        ([stage, task]): [
          string,
          ReadPlanInspection["dependencies"][string],
        ] => {
          const dependency: ReadPlanInspection["dependencies"][string] = {
            operation: task.dependency.operation,
            strategy: task.strategy,
            pipeline: task.bulk ?? task.pipeline,
            child: inspection(task.relation.child),
          };
          if (task.strategy === "mongodb")
            dependency.execution = task.bulk ? "bulk" : "parent-scoped";
          if (task.reason) dependency.reason = task.reason;
          const group =
            stage.kind === "load"
              ? compiled.reductionGroups.find((group) =>
                  group.stages.includes(stage),
                )
              : undefined;
          if (group)
            dependency.fusedWith = group.stages
              .filter((member) => member !== stage)
              .map((member) => member.key);
          else dependency.fusionReason = task.fusionReason;
          return [stage.kind === "load" ? stage.key : "", dependency];
        },
      ),
    ),
    reductionGroups: compiled.reductionGroups.map((group) => ({
      loads: group.stages.map((stage) => stage.key),
      phase: group.phase,
      pipeline: group.pipeline,
    })),
  };
}

function buildRead<R extends ResourceLike, Row extends object, Context>(
  resource: R,
  options: ReaderOptions<R, Row, Context>,
  requiresContext: boolean,
): ReadExecutor<R, Context> {
  const def = definition(resource, options as unknown as RuntimeReaderOptions);
  const prepare = (input: unknown, context: unknown) => {
    if (requiresContext && (context === undefined || context === null))
      throw new ReadValidationError("A read context is required");
    return compile(def, parsedQuery(def, input), context);
  };
  const execute = async (
    input: unknown,
    context?: unknown,
  ): Promise<{ rows: DataRow[] }> => {
    const compiled = prepare(input, context);
    const selected = await selectRows(
      def.state.collection.scan(compiled.pipeline, def.state.batchSize),
      compiled,
      context,
    );
    const rows = await project(selected, compiled, context);
    return { rows };
  };
  // The sole opaque-result construction boundary, after execution/schema validation.
  return Object.assign(execute, {
    __resource: resource,
    inspect: (input: ReadQuery<R>, context?: unknown) =>
      inspection(prepare(input, context)),
  }) as unknown as ReadExecutor<R, Context>;
}

export function defineRead<
  R extends ResourceLike,
  Row extends object,
  Context = unknown,
>(
  resource: CompatibleResource<R, NoInfer<Row>>,
  options: ReaderOptions<R, Row, Context>,
): ReadExecutor<R, Context> {
  return buildRead(
    resource,
    options,
    options.source.state.requiresContext ?? false,
  );
}

export interface ReadContext<Context extends object> {
  readonly mongo: ReturnType<typeof createMongo<Context>>;
  defineRead<R extends ResourceLike, Row extends object>(
    resource: CompatibleResource<R, NoInfer<Row>>,
    options: ReaderOptions<R, Row, Context>,
  ): ReadExecutor<R, Context>;
}

/** Declare backend context once; all child plans and callbacks retain its type. */
export function createReadContext<
  Context extends object,
>(): ReadContext<Context> {
  return {
    mongo: createMongo<Context>(true),
    defineRead<R extends ResourceLike, Row extends object>(
      resource: CompatibleResource<R, NoInfer<Row>>,
      options: ReaderOptions<R, Row, Context>,
    ): ReadExecutor<R, Context> {
      return buildRead(resource, options, true);
    },
  };
}
