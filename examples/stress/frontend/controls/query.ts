import {
  normalizeReadQuery,
  type ExactReadQuery,
  type NormalizedReadQuery,
  type ReadQuery,
  type ReadSelection,
  type ResourceLike,
} from "@n/adira.core.ts";
import { readLimits } from "../../contracts/resources";
export { when } from "@n/adira.core.ts";

/** Preserve the callback's argument list and exact literal result in a single call. */
export function deriveQuery<
  R extends ResourceLike,
  Args extends unknown[],
  const SelectionContext extends ReadSelection<R>,
  const Q extends ReadQuery<R>,
>(
  resource: R,
  // Context keeps nested selection flags literal; only Q infers the result's shape.
  callback: (
    ...args: Args
  ) => Q & { select: NoInfer<SelectionContext> } & ExactReadQuery<
      NoInfer<R>,
      NoInfer<Q>
    >,
) {
  return (...args: Args): NormalizedReadQuery<Q> => {
    const query = callback(...args);
    return normalizeReadQuery<R, Q>(resource, query, readLimits);
  };
}
