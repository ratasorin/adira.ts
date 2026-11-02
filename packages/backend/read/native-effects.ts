import type { PipelineStage } from "mongoose";
import type { NativeOperation, PlanState } from "./plan";

// This is an optimization allowlist, not a restriction on accepted native code.
// Unknown or nonrepeatable operations keep their original execution boundary.
const repeatableOperators = new Set(
  `
  $literal $expr $and $or $nor $not $eq $ne $gt $gte $lt $lte $in $nin
  $exists $type $isNumber $isArray $all $elemMatch $regex $options $mod
  $add $subtract $multiply $divide $abs $ceil $floor $round $trunc $pow $sqrt
  $min $max $sum $avg $first $last $push $addToSet $count
  $cond $ifNull $switch $let $getField $setField $unsetField $mergeObjects
  $objectToArray $arrayToObject $arrayElemAt $size $slice $filter $map $reduce
  $concatArrays $range $reverseArray $zip $indexOfArray $sortArray
  $setUnion $setIntersection $setDifference $setEquals $setIsSubset
  $allElementsTrue $anyElementTrue
  $concat $toLower $toUpper $toString $convert $toInt $toLong $toDouble
  $toDecimal $toBool $toDate $indexOfCP $indexOfBytes $substrCP $substrBytes
  $strLenCP $strLenBytes $split $trim $ltrim $rtrim $replaceOne $replaceAll
  $regexMatch $regexFind $regexFindAll $strcasecmp
  $dateToString $dateFromString $dateToParts $dateFromParts $dateAdd
  $dateSubtract $dateDiff $dateTrunc $year $month $dayOfMonth $dayOfWeek
  $dayOfYear $hour $minute $second $millisecond $isoWeek $isoWeekYear
  $match $sort $limit $skip $group $project $set $addFields $unset $lookup
  $unwind $replaceRoot $replaceWith $facet $bucket $bucketAuto $sortByCount
  $unionWith $documents $setWindowFields $rank $denseRank $documentNumber
  $shift $derivative $integral $expMovingAvg $stdDevPop $stdDevSamp
  $top $topN $bottom $bottomN $firstN $lastN $minN $maxN
  `
    .trim()
    .split(/\s+/),
);

/** Conservative repeatability check, including any foreign lookup pipelines. */
export function repeatableMongo(value: unknown): boolean {
  if (!value || typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every(repeatableMongo);
  // BSON values, Dates, and regular expressions are literals.
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return true;
  return Object.entries(value).every(
    ([key, child]) =>
      key === "$literal" ||
      ((!key.startsWith("$") || repeatableOperators.has(key)) &&
        repeatableMongo(child)),
  );
}

/** These outer stages operate independently on each parent. Foreign stages may group. */
export function rowLocalWrites(
  stages: readonly PipelineStage[],
): ReadonlySet<string> | undefined {
  const writes = new Set<string>();
  for (const stage of stages) {
    const entries = Object.entries(stage);
    if (entries.length !== 1 || !repeatableMongo(stage)) return undefined;
    const [operator, payload] = entries[0];
    let keys: unknown[];
    if (operator === "$lookup") {
      keys = [(payload as { as?: unknown }).as];
    } else if (operator === "$set" || operator === "$addFields") {
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        return undefined;
      keys = Object.keys(payload);
    } else if (operator === "$unset") {
      keys = Array.isArray(payload) ? payload : [payload];
    } else {
      return undefined;
    }
    for (const key of keys) {
      if (typeof key !== "string" || !key || key.startsWith("$"))
        return undefined;
      writes.add(key.split(".")[0]);
    }
  }
  return writes;
}

export interface NativeUnit {
  readonly stages: readonly PipelineStage[];
  readonly operation?: NativeOperation;
  /** Undefined denotes an opaque or stream-dependent operation. */
  readonly writes?: ReadonlySet<string>;
  readonly keeps?: ReadonlySet<string>;
}

/** Keep producers atomic so predicates cannot observe their temporary payload. */
export function nativeUnits(
  state: PlanState,
  stages: readonly PipelineStage[],
): NativeUnit[] {
  const units: NativeUnit[] = [];
  for (let index = 0; index < stages.length; index++) {
    const stage = stages[index];
    const operation = state.nativeOperations?.get(stage);
    if (operation?.kind === "producer") {
      const producer = operation.producer;
      const writes = rowLocalWrites(producer.stages);
      units.push({
        stages: producer.stages,
        operation,
        writes: writes && new Set([...writes, ...producer.provides]),
      });
      index += producer.stages.length - 1;
    } else if (operation?.kind === "derive") {
      units.push({
        stages: [stage],
        operation,
        writes: repeatableMongo(stage) ? new Set([operation.key]) : undefined,
      });
    } else if (operation?.kind === "project") {
      units.push({
        stages: [stage],
        operation,
        writes: new Set(),
        keeps: operation.keys,
      });
    } else if (operation?.kind === "consume" && repeatableMongo(stage)) {
      units.push({ stages: [stage], operation, writes: new Set() });
    } else {
      units.push({ stages: [stage] });
    }
  }
  return units;
}

/** Delayed work must not observe predicate flags added to the parent document. */
export function readsRowShape(value: unknown): boolean {
  if (typeof value === "string")
    return (
      value === "$$ROOT" ||
      value === "$$CURRENT" ||
      /^\$(?:\$(?:ROOT|CURRENT)\.)?__adira_/.test(value)
    );
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(readsRowShape);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.entries(value).some(([key, child]) => {
    if (key === "$literal") return false;
    if (key === "$lookup" && child && typeof child === "object") {
      // Foreign pipelines have their own ROOT/CURRENT; only parent inputs can
      // observe metadata added to this stream, including a whole-row let value.
      const lookup = child as { let?: unknown; localField?: string };
      return (
        readsRowShape(lookup.let) || !!lookup.localField?.startsWith("__adira_")
      );
    }
    if (
      key === "$getField" &&
      (!child || typeof child !== "object" || !("input" in child))
    )
      return true;
    return readsRowShape(child);
  });
}

/** Only an independent, repeatable output suffix may cross native pagination. */
export function nativePageSplit(
  state: PlanState,
  stages: readonly PipelineStage[],
  pageInputs: ReadonlySet<string>,
  predicateWrites: ReadonlySet<string>,
): { before: PipelineStage[]; after: PipelineStage[] } {
  const units = nativeUnits(state, stages);
  let boundary = units.length;
  for (let index = units.length - 1; index >= 0; index--) {
    const { operation, writes, stages } = units[index];
    // Source filters/sorts, projections, global operations and raw transforms
    // retain their position. A contiguous suffix also preserves field versions.
    if (
      !writes ||
      (operation?.kind !== "derive" && operation?.kind !== "producer") ||
      [...writes].some(
        (key) => pageInputs.has(key) || key.startsWith("__adira_"),
      ) ||
      stages.some(readsRowShape)
    )
      break;
    const requires =
      operation.kind === "derive"
        ? operation.requires
        : operation.producer.requires;
    // Predicate preparation runs before the delayed suffix. It must not clobber
    // a value the original suffix would have consumed before that preparation.
    if ([...requires].some((key) => predicateWrites.has(key))) break;
    boundary = index;
  }
  return {
    before: units.slice(0, boundary).flatMap((unit) => [...unit.stages]),
    after: units.slice(boundary).flatMap((unit) => [...unit.stages]),
  };
}
