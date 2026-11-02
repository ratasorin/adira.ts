import type {
  ReadQuery,
  ResourceLike,
  ScalarDefinition,
  SortableKeys,
} from "@n/adira.core.ts";
import {
  emptyFilters,
  label,
  type BoundFilterGroup,
  type FilterEditors,
  type FilterGroup,
} from "./filter-state";

export type ScalarKey<R extends ResourceLike> = {
  [K in keyof R["fields"]]: R["fields"][K] extends ScalarDefinition ? K : never;
}[keyof R["fields"]] &
  string;
type RelationKey<R extends ResourceLike> = {
  [K in keyof R["fields"]]: R["fields"][K] extends { kind: "relation" }
    ? K
    : never;
}[keyof R["fields"]] &
  string;
export type ColumnVisibility<R extends ResourceLike> = {
  [K in ScalarKey<R>]: boolean;
};
export type Direction = "asc" | "desc";
type OrderBy<R extends ResourceLike> = NonNullable<ReadQuery<R>["orderBy"]>;
export interface SelectionInputs<R extends ResourceLike> {
  columns: ColumnVisibility<R>;
  filters: FilterGroup<R>;
}
export interface CollectionInputs<
  R extends ResourceLike,
> extends SelectionInputs<R> {
  orderBy: OrderBy<R> | undefined;
  limit: number;
  offset: number;
}
export function selectionInputs<R extends ResourceLike>(
  columns: ColumnVisibility<R>,
): SelectionInputs<R> {
  return { columns: { ...columns }, filters: emptyFilters<R>() };
}
export function collectionInputs<R extends ResourceLike>(
  columns: ColumnVisibility<R>,
  limit = 20,
): CollectionInputs<R> {
  return {
    ...selectionInputs<R>(columns),
    orderBy: undefined,
    limit,
    offset: 0,
  };
}

export interface BoundSort {
  direction: Direction | undefined;
  ascending: () => void;
  descending: () => void;
}
export interface BoundColumn {
  key: string;
  label: string;
  selected: boolean;
  disabled: boolean;
  toggle: () => void;
  sorting: BoundSort | undefined;
}
export interface BoundRelation {
  key: string;
  label: string;
  many: boolean;
  selected: boolean;
  disabled: boolean;
  toggle: () => void;
  child: BoundInputs | undefined;
}
export interface BoundSelection {
  columns: readonly BoundColumn[];
  relations: readonly BoundRelation[];
}
export interface BoundPage {
  limit: number;
  offset: number;
  setLimit: (limit: number) => void;
  setOffset: (offset: number) => void;
}
export interface BoundInputs {
  selection: BoundSelection;
  filters: BoundFilterGroup;
  page: BoundPage | undefined;
}
export interface TableColumn<Row> {
  key: string;
  label: string;
  read: (row: Row) => unknown;
  sorting: BoundSort | undefined;
}
export interface BoundTable<Row> extends BoundInputs {
  columns: readonly TableColumn<Row>[];
  sort: { label: string; clear: () => void } | undefined;
}

/** Add enabled presentation columns while keeping the table's inferred row type. */
export function appendColumns<Row>(
  table: BoundTable<Row>,
  ...columns: readonly (TableColumn<NoInfer<Row>> | undefined)[]
): BoundTable<Row> {
  return {
    ...table,
    columns: table.columns.concat(
      columns.filter(
        (column): column is TableColumn<Row> => column !== undefined,
      ),
    ),
  };
}
export interface ColumnDefinition<R extends ResourceLike, Row> {
  key: ScalarKey<R>;
  read: (row: Row) => unknown;
  sort:
    | {
        key: SortableKeys<R>;
        order: (direction: Direction) => OrderBy<R>;
      }
    | undefined;
}

/** Accessors are checked against the inferred response row before rendering. */
export function columnsFor<R extends ResourceLike, Row>() {
  return {
    relation: <K extends RelationKey<R> & keyof Row>(
      key: K,
    ): TableColumn<Row> => ({
      key,
      label: label(key),
      read: (row) => row[key],
      sorting: undefined,
    }),
    value: <K extends ScalarKey<R> & keyof Row>(
      key: K,
    ): ColumnDefinition<R, Row> => ({
      key,
      read: (row) => row[key],
      sort: undefined,
    }),
    sortable: <K extends ScalarKey<R> & SortableKeys<R> & keyof Row>(
      key: K,
      order: (
        direction: Direction,
      ) => OrderBy<R> & Record<NoInfer<K>, Direction>,
    ): ColumnDefinition<R, Row> => ({
      key,
      read: (row) => row[key],
      sort: { key, order },
    }),
  };
}

function selectedCount<R extends ResourceLike>(
  state: SelectionInputs<R>,
  relations: readonly BoundRelation[],
) {
  return (
    Object.values(state.columns).filter(Boolean).length +
    relations.filter((r) => r.selected).length
  );
}
export function includeControl(
  config: Omit<BoundRelation, "label" | "disabled">,
): BoundRelation {
  return { ...config, label: label(config.key), disabled: false };
}

/** Bind controls only; selections and queries stay in the screen's callback. */
export function bindCollection<
  R extends ResourceLike,
  Row,
  Values extends CollectionInputs<R>,
>(
  definitions: readonly ColumnDefinition<R, Row>[],
  editors: FilterEditors<R>,
  state: Values,
  update: (state: Values) => void,
  relations: readonly BoundRelation[] = [],
): BoundTable<Row> {
  const count = selectedCount(state, relations);
  const columns = definitions.map(
    (column): BoundColumn & { read: (row: Row) => unknown } => {
      const selected = state.columns[column.key];
      const sort = column.sort;
      const direction = sort ? state.orderBy?.[sort.key] : undefined;
      const choose = (direction: Direction) => {
        if (sort)
          update({
            ...state,
            offset: 0,
            orderBy:
              state.orderBy?.[sort.key] === direction
                ? undefined
                : sort.order(direction),
          });
      };
      return {
        key: column.key,
        label: label(column.key),
        selected,
        disabled: selected && count === 1,
        read: column.read,
        toggle: () =>
          update({
            ...state,
            columns: { ...state.columns, [column.key]: !selected },
            offset: 0,
            orderBy:
              sort && state.orderBy?.[sort.key] ? undefined : state.orderBy,
          }),
        sorting:
          selected && sort
            ? {
                direction,
                ascending: () => choose("asc"),
                descending: () => choose("desc"),
              }
            : undefined,
      };
    },
  );
  const sorted = columns.find((column) => column.sorting?.direction);
  return {
    selection: {
      columns,
      relations: relations.map((relation) => ({
        ...relation,
        disabled: relation.selected && count === 1,
      })),
    },
    columns: columns.filter((column) => column.selected),
    filters: editors.bind(state.filters, (filters) =>
      update({ ...state, filters, offset: 0 }),
    ),
    page: {
      limit: state.limit,
      offset: state.offset,
      setLimit: (limit) => update({ ...state, limit, offset: 0 }),
      setOffset: (offset) => {
        if (Number.isInteger(offset) && offset >= 0)
          update({ ...state, offset });
      },
    },
    sort: sorted?.sorting
      ? {
          label: `${sorted.label} · ${sorted.sorting.direction === "asc" ? "ascending" : "descending"}`,
          clear: () => update({ ...state, orderBy: undefined, offset: 0 }),
        }
      : undefined,
  };
}
export function bindSelection<
  R extends ResourceLike,
  Row,
  Values extends SelectionInputs<R>,
>(
  definitions: readonly ColumnDefinition<R, Row>[],
  editors: FilterEditors<R>,
  state: Values,
  update: (state: Values) => void,
  relations: readonly BoundRelation[] = [],
): BoundInputs {
  const count = selectedCount(state, relations);
  return {
    selection: {
      columns: definitions.map((column) => ({
        key: column.key,
        label: label(column.key),
        selected: state.columns[column.key],
        disabled: state.columns[column.key] && count === 1,
        sorting: undefined,
        toggle: () =>
          update({
            ...state,
            columns: {
              ...state.columns,
              [column.key]: !state.columns[column.key],
            },
          }),
      })),
      relations: relations.map((relation) => ({
        ...relation,
        disabled: relation.selected && count === 1,
      })),
    },
    filters: editors.bind(state.filters, (filters) =>
      update({ ...state, filters }),
    ),
    page: undefined,
  };
}
