import type {
  FilterDefinitions,
  FilterKeys,
  OperatorsOf,
  OperatorValue,
  ResourceLike,
} from "@n/adira.core.ts";
import type { InputParser } from "./input-controls";

export type FilterKey<R extends ResourceLike> = FilterKeys<R> & string;

/** An approved operand's schema and parsers; consumers own rendering and state. */
export interface OperatorDescriptor<
  R extends ResourceLike,
  K extends FilterKey<R>,
  Op extends OperatorsOf<FilterDefinitions<R>[K]>,
> extends InputParser<OperatorValue<FilterDefinitions<R>[K], Op>> {
  readonly field: K;
  readonly operator: Op;
}

export type FilterDescriptors<R extends ResourceLike> = {
  [K in FilterKey<R>]: {
    [Op in OperatorsOf<FilterDefinitions<R>[K]>]: OperatorDescriptor<R, K, Op>;
  };
};

export function operatorFor<R extends ResourceLike>() {
  return <
    K extends FilterKey<R>,
    Op extends OperatorsOf<FilterDefinitions<R>[K]>,
  >(config: {
    field: K;
    operator: Op;
    input: InputParser<NoInfer<OperatorValue<FilterDefinitions<R>[K], Op>>>;
  }): OperatorDescriptor<R, K, Op> => ({
    ...config.input,
    field: config.field,
    operator: config.operator,
  });
}
