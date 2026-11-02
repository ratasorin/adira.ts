import type { ReadData, ReadQuery, ResourceLike } from "@n/adira.core.ts";
import type { Entity } from "../../contracts/resources";
import type { BoundTable } from "./table-controls";

export interface Screen<
  R extends ResourceLike,
  Values,
  Q extends ReadQuery<R>,
> {
  resource: R;
  entity: Entity;
  title: string;
  initial: () => Values;
  query: (values: Values) => Q;
  bind: (
    values: Values,
    update: (values: Values) => void,
  ) => BoundTable<ReadData<R, Q>["rows"][number]>;
}

/** Page configuration preserves the literal callback's inferred Q. */
export function defineScreen<R extends ResourceLike, Values>(
  resource: R,
  initial: () => Values,
) {
  return <const Q extends ReadQuery<R>>(config: {
    entity: Entity;
    title: string;
    query: (values: NoInfer<Values>) => Q;
    bind: (
      values: NoInfer<Values>,
      update: (values: NoInfer<Values>) => void,
    ) => BoundTable<ReadData<R, NoInfer<Q>>["rows"][number]>;
  }): Screen<R, Values, Q> => ({ ...config, resource, initial });
}
