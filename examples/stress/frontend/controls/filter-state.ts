/** Optional dashboard state and menu helpers. Public parsers do not depend on this module. */
import type {
  FilterDefinitions,
  OperatorsOf,
  OperatorValue,
  ReadOperator,
  ReadWhere,
  ResourceLike,
} from "@n/adira.core.ts";
import type { FilterKey, OperatorDescriptor } from "./filter-controls";
import type { InputParser } from "./input-controls";

export const label = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());

export type InputDraft<T> =
  | { status: "valid"; text: string; value: T }
  | { status: "editing"; text: string; error: string };

/** Presentation data for the dashboard's own React component. */
export interface FilterInputProps {
  text: string;
  error: string | undefined;
  kind: "text" | "number" | "boolean" | "enum" | "list";
  options: readonly string[];
  nullable: boolean;
  isNull: boolean;
  onTextChange: (text: string) => void;
  onNullChange: (isNull: boolean) => void;
}

export interface FilterValue<R extends ResourceLike> {
  readonly kind: "rule";
  readonly field: FilterKey<R>;
  readonly operator: ReadOperator;
  condition: () => ReadWhere<R>;
  inputProps: (update: (next: FilterValue<R>) => void) => FilterInputProps;
}
export interface FilterDraft<
  R extends ResourceLike,
  K extends FilterKey<R>,
  Op extends OperatorsOf<FilterDefinitions<R>[K]>,
> extends FilterValue<R> {
  readonly field: K;
  readonly operator: Op;
  readonly input: InputDraft<OperatorValue<FilterDefinitions<R>[K], Op>>;
}
export interface FilterRuleFactory<
  R extends ResourceLike,
  K extends FilterKey<R>,
  Op extends OperatorsOf<FilterDefinitions<R>[K]>,
> {
  create: () => FilterDraft<R, K, Op>;
  value: (
    value: OperatorValue<FilterDefinitions<R>[K], Op>,
  ) => FilterDraft<R, K, Op>;
  read: (text: string) => FilterDraft<R, K, Op>;
}
export type FilterRuleFactories<R extends ResourceLike> = {
  [K in FilterKey<R>]: {
    [Op in OperatorsOf<FilterDefinitions<R>[K]>]: FilterRuleFactory<R, K, Op>;
  };
};

function readDraft<T>(parser: InputParser<T>, text: string): InputDraft<T> {
  const result = parser.safeParseText(text);
  return result.success
    ? { status: "valid", text, value: result.value }
    : { status: "editing", text, error: result.error };
}

/** Capture operand types for the dashboard's heterogeneous filter list. */
export function ruleFor<R extends ResourceLike>() {
  return <
    K extends FilterKey<R>,
    Op extends OperatorsOf<FilterDefinitions<R>[K]>,
  >(
    descriptor: OperatorDescriptor<R, K, Op>,
    where: (
      value: NoInfer<OperatorValue<FilterDefinitions<R>[K], Op>>,
    ) => ReadWhere<R>,
  ): FilterRuleFactory<R, K, Op> => {
    type Draft = FilterDraft<R, K, Op>;
    const metadata = descriptor.schema.native;
    const kind =
      descriptor.operator === "$in" || descriptor.operator === "$nin"
        ? "list"
        : metadata?.type === "string"
          ? "text"
          : (metadata?.type ?? "text");
    const initialText =
      kind === "number"
        ? "0"
        : kind === "boolean"
          ? "true"
          : kind === "enum"
            ? (metadata?.values?.[0] ?? "")
            : "";
    const make = (input: Draft["input"]): Draft => ({
      kind: "rule",
      field: descriptor.field,
      operator: descriptor.operator,
      input,
      condition: () => {
        if (input.status !== "valid")
          throw new Error(`${descriptor.field}: ${input.error}`);
        return where(input.value);
      },
      inputProps: (update) => ({
        text: input.text,
        error: input.status === "editing" ? input.error : undefined,
        kind,
        options:
          kind === "boolean" ? ["true", "false"] : (metadata?.values ?? []),
        nullable: metadata?.nullable ?? false,
        isNull: input.status === "valid" && input.value === null,
        onTextChange: (text) => update(make(readDraft(descriptor, text))),
        onNullChange: (isNull) => {
          if (isNull) {
            const value = descriptor.parse(null);
            update(
              make({ status: "valid", text: descriptor.format(value), value }),
            );
          } else update(make(readDraft(descriptor, initialText)));
        },
      }),
    });
    return {
      create: () => make(readDraft(descriptor, initialText)),
      value: (value) => {
        const parsed = descriptor.parse(value);
        return make({
          status: "valid",
          text: descriptor.format(parsed),
          value: parsed,
        });
      },
      read: (text) => make(readDraft(descriptor, text)),
    };
  };
}

export interface FilterGroup<R extends ResourceLike> {
  kind: "group";
  operator: "$and" | "$or";
  negated: boolean;
  children: readonly (FilterValue<R> | FilterGroup<R>)[];
}
export const emptyFilters = <R extends ResourceLike>(): FilterGroup<R> => ({
  kind: "group",
  operator: "$and",
  negated: false,
  children: [],
});
interface RuleOption<R extends ResourceLike> {
  id: string;
  create: () => FilterValue<R>;
}
export interface FilterChoice<R extends ResourceLike> extends RuleOption<R> {
  field: FilterKey<R>;
  predicate: boolean;
  operators: readonly RuleOption<R>[];
}
interface BoundOption {
  id: string;
  label: string;
  choose: () => void;
}
export interface BoundRule {
  field: string;
  operator: string;
  input: FilterInputProps;
  fields: readonly BoundOption[];
  operators: readonly BoundOption[];
}
export interface BoundFilterGroup {
  operator: "$and" | "$or";
  negated: boolean;
  setOperator: (operator: "$and" | "$or") => void;
  setNegated: (negated: boolean) => void;
  addFilter: (() => void) | undefined;
  addGroup: () => void;
  clear: () => void;
  children: readonly (
    | { kind: "rule"; rule: BoundRule; remove: () => void }
    | { kind: "group"; group: BoundFilterGroup; remove: () => void }
  )[];
}
interface WhereCombiner<W> {
  and: (children: readonly [W, ...W[]]) => W;
  or: (children: readonly [W, ...W[]]) => W;
  not: (child: W) => W;
}
export interface FilterEditors<R extends ResourceLike> {
  where: (group: FilterGroup<R>) => ReadWhere<R> | undefined;
  bind: (
    group: FilterGroup<R>,
    update: (group: FilterGroup<R>) => void,
  ) => BoundFilterGroup;
}

/** This control produces only an approved where value, never a whole query. */
export function defineFilterEditors<R extends ResourceLike>(config: {
  fields: readonly FilterChoice<R>[];
  combine: WhereCombiner<ReadWhere<R>>;
}): FilterEditors<R> {
  const where = (group: FilterGroup<R>): ReadWhere<R> | undefined => {
    const children: ReadWhere<R>[] = [];
    for (const child of group.children) {
      const condition =
        child.kind === "group" ? where(child) : child.condition();
      if (condition !== undefined) children.push(condition);
    }
    const [first, ...rest] = children;
    if (first === undefined) return undefined;
    const result =
      rest.length === 0
        ? first
        : group.operator === "$and"
          ? config.combine.and([first, ...rest])
          : config.combine.or([first, ...rest]);
    return group.negated ? config.combine.not(result) : result;
  };
  const bind: FilterEditors<R>["bind"] = (group, update) => {
    const first =
      config.fields.find((field) => field.field === "name") ?? config.fields[0];
    return {
      operator: group.operator,
      negated: group.negated,
      setOperator: (operator) => update({ ...group, operator }),
      setNegated: (negated) => update({ ...group, negated }),
      addFilter: first
        ? () =>
            update({ ...group, children: [...group.children, first.create()] })
        : undefined,
      addGroup: () =>
        update({ ...group, children: [...group.children, emptyFilters<R>()] }),
      clear: () => update(emptyFilters<R>()),
      children: group.children.map((child, index) => {
        const change = (next: FilterValue<R> | FilterGroup<R>) =>
          update({
            ...group,
            children: group.children.map((current, i) =>
              i === index ? next : current,
            ),
          });
        const remove = () =>
          update({
            ...group,
            children: group.children.filter((_, i) => i !== index),
          });
        if (child.kind === "group")
          return { kind: "group", group: bind(child, change), remove };
        const field = config.fields.find(
          (field) => field.field === child.field,
        );
        return {
          kind: "rule",
          remove,
          rule: {
            field: child.field,
            operator: child.operator,
            input: child.inputProps(change),
            fields: config.fields.map((field) => ({
              id: field.id,
              label: `${label(field.id)}${field.predicate ? " · predicate" : ""}`,
              choose: () => change(field.create()),
            })),
            operators: (field?.operators ?? []).map((operator) => ({
              id: operator.id,
              label: operator.id,
              choose: () => change(operator.create()),
            })),
          },
        };
      }),
    };
  };
  return { where, bind };
}
