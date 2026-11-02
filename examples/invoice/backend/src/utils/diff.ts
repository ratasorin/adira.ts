import { Leafs as _Leafs, Leafs } from "@n/adira.core.ts";
import mongoose from "mongoose";
type FlatMapping = Record<string, any>;
export type DiffPrimitive = string | number | boolean | null;
export type DiffObject = object;
export type DiffValue = DiffPrimitive | DiffObject;
export type DiffValueResolution = {
    old: DiffValue | undefined | null;
    new: DiffValue | undefined | null;
};
export type DiffLeaf<T extends object, Prefix extends string | undefined = undefined> = Prefix extends undefined ? _Leafs<T> : Prefix | `${Prefix}.${_Leafs<T>}`;
type ExtractPathValue<T, Path extends string> = Path extends "" ? T : Path extends `${infer Head}.${infer Rest}` ? Head extends keyof T ? ExtractPathValue<NonNullable<T[Head]>, Rest> : never : Path extends keyof T ? NonNullable<T[Path]> : never;
export type ExtractLeafValue<T extends object, Leaf extends string, Prefix extends string | undefined = undefined> = Prefix extends undefined ? ExtractPathValue<T, Leaf> : Leaf extends Prefix ? T : Leaf extends `${Prefix}.${infer Rest}` ? ExtractPathValue<T, Rest> : never;
export type DiffTransformHandler<T extends object, K extends DiffLeaf<T, Prefix>, Prefix extends string | undefined = undefined> = (oldV: ExtractLeafValue<T, K, Prefix> | undefined | null, newV: ExtractLeafValue<T, K, Prefix> | undefined | null, type: "addition" | "removal" | "modification", leaf: K) => Promise<DiffValueResolution | undefined | null>;
export type DiffTransformMap<T extends object, Prefix extends string | undefined = undefined> = {
    [K in DiffLeaf<T, Prefix>]?: DiffTransformHandler<T, K, Prefix>;
};
export type DiffTransformCallback<T extends object, Prefix extends string | undefined = undefined> = <K extends DiffLeaf<T, Prefix>>(leaf: K, oldV: ExtractLeafValue<T, K, Prefix> | undefined | null, newV: ExtractLeafValue<T, K, Prefix> | undefined | null, type: "addition" | "removal" | "modification") => Promise<DiffValueResolution | undefined | null>;
export type DiffTransformer<T extends object, Prefix extends string | undefined = undefined> = DiffTransformCallback<T, Prefix> | DiffTransformMap<T, Prefix>;
function flattenForDiff<T>(obj: T, ignore: string[] = [], prefix = "", result: FlatMapping = {}): FlatMapping {
    if (Array.isArray(obj)) {
        if (prefix)
            result[prefix] = obj;
        return result;
    }
    // Stop recursion at null, primitives, or "Leaf" types
    if (obj === null ||
        typeof obj !== "object" ||
        obj instanceof Date ||
        obj instanceof mongoose.Types.ObjectId) {
        result[prefix] = obj;
        return result;
    }
    for (const key in obj) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        // Skip ignored paths
        if (ignore.some((i) => fullPath === i || fullPath.startsWith(`${i}.`))) {
            continue;
        }
        flattenForDiff((obj as any)[key], ignore, fullPath, result);
    }
    return result;
}
export interface ObjectDiffEvent<T> {
    field: Leafs<T>;
    old_value: DiffValue | undefined;
    new_value: DiffValue | undefined;
    type: "addition" | "removal" | "modification";
}
export interface DiffObjectOptions<T extends object> {
    ignore?: Leafs<T>[];
    transform?: DiffTransformer<T>;
}
type DiffChangeShape = {
    field: string;
    old_value: DiffValue | undefined | null;
    new_value: DiffValue | undefined | null;
    type: "addition" | "removal" | "modification";
};
async function applyTransform<T extends object, TChange extends DiffChangeShape, Prefix extends string | undefined = undefined>(change: TChange, transform?: DiffTransformer<T, Prefix>): Promise<TChange> {
    if (!transform)
        return change;
    const leaf = normalizeDiffLeaf(change.field) as DiffLeaf<T, Prefix>;
    const nextValue = typeof transform === "function"
        ? await transform(leaf, change.old_value as ExtractLeafValue<T, typeof leaf, Prefix>, change.new_value as ExtractLeafValue<T, typeof leaf, Prefix>, change.type)
        : await transform[leaf]?.(change.old_value as ExtractLeafValue<T, typeof leaf, Prefix>, change.new_value as ExtractLeafValue<T, typeof leaf, Prefix>, change.type, leaf);
    if (!nextValue)
        return change;
    return {
        ...change,
        old_value: nextValue.old,
        new_value: nextValue.new,
    };
}
export async function diffObject<T extends object>(oldObj: T, newObj: T, options: DiffObjectOptions<T> = {}): Promise<ObjectDiffEvent<T>[]> {
    const events: ObjectDiffEvent<T>[] = [];
    const ignore = options.ignore || [];
    // Flatten both objects into simple key-value maps
    const oldFlat = flattenForDiff(oldObj, ignore as string[]);
    const newFlat = flattenForDiff(newObj, ignore as string[]);
    // Get a unique set of all keys present in either object
    const allKeys = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]);
    for (const key of allKeys) {
        const oldVal = oldFlat[key];
        const newVal = newFlat[key];
        // We cast the key to Leafs<T> because the flattener
        // strictly follows the object structure
        const field = key as Leafs<T>;
        // 1. Addition: Key exists in new but not old
        if (!(key in oldFlat)) {
            events.push({
                field,
                old_value: undefined,
                new_value: newVal,
                type: "addition",
            });
        }
        // 2. Removal: Key exists in old but not new
        else if (!(key in newFlat)) {
            events.push({
                field,
                old_value: oldVal,
                new_value: undefined,
                type: "removal",
            });
        }
        // 3. Modification: Values are different
        // Note: We use a simple comparison because complex types were stopped at during flattening
        else if (!isEqual(oldVal, newVal)) {
            events.push({
                field,
                old_value: oldVal,
                new_value: newVal,
                type: "modification",
            });
        }
    }
    const transformedEvents: ObjectDiffEvent<T>[] = [];
    for await (const event of events) {
        const ev = await applyTransform<T, ObjectDiffEvent<T>>(event, options.transform);
        transformedEvents.push(ev);
    }

    return transformedEvents;
}
const isEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b); // Or use your Mongoose-aware logic
export interface ArrayDiffEvent {
    field: string;
    old_value: DiffValue | undefined | null;
    new_value: DiffValue | undefined | null;
    type: "addition" | "removal" | "modification";
}
export interface DiffArrayOptions<T, Prefix extends string | undefined = undefined> {
    comparator: (a: T, b: T) => boolean;
    /**
     * Prefix applied to all emitted fields, e.g. "viewers" -> "viewers[0].name"
     */
    fieldPrefix?: Prefix;
    /**
     * Stable unique identifier for array items. When provided, items are matched
     * by this key (using strict equality in a Map), and fields are reported as:
     *   `${fieldPrefix}[id=${key}]...`
     *
     * Keys must be unique within each array, otherwise an error is thrown.
     */
    primaryKey?: (item: T) => string | number;
    transform?: T extends object ? DiffTransformer<T, Prefix> : never;
}
function prefixField(prefix: string | undefined, field: string): string {
    return prefix ? `${prefix}${field}` : field;
}
export function normalizeDiffLeaf(field: string): string {
    return field
        .split(".")
        .map((segment) => segment.replace(/\[[^\]]*]/g, ""))
        .filter(Boolean)
        .join(".");
}
export function matchesDiffLeaf(field: string, leaf: string): boolean {
    return normalizeDiffLeaf(field) === normalizeDiffLeaf(leaf);
}
function assertValidKey(key: unknown): asserts key is string | number {
    if (typeof key !== "string" && typeof key !== "number") {
        throw new Error(`diffArray primaryKey must return string|number. Got ${typeof key}`);
    }
}
function assertUniqueKeys<T>(entries: {
    key: string | number;
    index: number;
}[], which: "new" | "old") {
    const seen = new Map<string | number, number>();
    for (const e of entries) {
        const prevIndex = seen.get(e.key);
        if (prevIndex !== undefined) {
            throw new Error(`diffArray primaryKey must be unique in ${which} array. Duplicate key: ${String(e.key)} (indices ${prevIndex} and ${e.index})`);
        }
        seen.set(e.key, e.index);
    }
}
export async function diffArray<TSchema, const Prefix extends string | undefined = undefined>(newArr: TSchema[], oldArr: TSchema[], options: DiffArrayOptions<TSchema, Prefix>): Promise<ArrayDiffEvent[]> {
    const events: ArrayDiffEvent[] = [];
    const fieldPrefix = options?.fieldPrefix;
    const cmp = options.comparator;
    // Fast/stable path: key-based matching with stable field reporting
    if (options?.primaryKey) {
        const keyOf = options.primaryKey;
        const newEntries = newArr.map((item, index) => {
            const key = keyOf(item) as unknown;
            assertValidKey(key);
            return { key, item, index };
        });
        const oldEntries = oldArr.map((item, index) => {
            const key = keyOf(item) as unknown;
            assertValidKey(key);
            return { key, item, index };
        });
        assertUniqueKeys(newEntries.map((e) => ({ key: e.key, index: e.index })), "new");
        assertUniqueKeys(oldEntries.map((e) => ({ key: e.key, index: e.index })), "old");
        const newByKey = new Map<string | number, TSchema>(newEntries.map((e) => [e.key, e.item]));
        const oldByKey = new Map<string | number, TSchema>(oldEntries.map((e) => [e.key, e.item]));
        const keyField = (key: string | number) => prefixField(fieldPrefix, `[id=${String(key)}]`);
        // Modifications + additions (in new order)
        for (const { key, item: newItem } of newEntries) {
            const oldItem = oldByKey.get(key);
            if (oldItem === undefined) {
                events.push({
                    field: keyField(key),
                    old_value: undefined,
                    new_value: newItem as DiffValue,
                    type: "addition",
                });
                continue;
            }
            const subChanges = await diffObject(oldItem as any, newItem as any);
            for (const change of subChanges) {
                events.push({
                    field: `${keyField(key)}.${String(change.field)}`,
                    old_value: change.old_value,
                    new_value: change.new_value,
                    type: change.type,
                });
            }
        }
        // Removals (in old order)
        for (const { key, item: oldItem } of oldEntries) {
            if (!newByKey.has(key)) {
                events.push({
                    field: keyField(key),
                    old_value: oldItem as DiffValue,
                    new_value: undefined,
                    type: "removal",
                });
            }
        }
        const transformedEvents: ArrayDiffEvent[] = [];
        for (const event of events) {
            transformedEvents.push(await applyTransform<TSchema & object, ArrayDiffEvent, Prefix>(event, options.transform as DiffTransformer<TSchema & object, Prefix>));
        }
        return transformedEvents;
    }
    const matchedOldIndices = new Set<number>();
    const matchedNewIndices = new Set<number>();
    // 1. Find Modifications/Matches
    for (let j = 0; j < newArr.length; j++) {
        for (let i = 0; i < oldArr.length; i++) {
            if (matchedOldIndices.has(i))
                continue;
            const oldItem = oldArr[i];
            const newItem = newArr[j];
            if (newItem && oldItem && cmp(newItem, oldItem)) {
                matchedOldIndices.add(i);
                matchedNewIndices.add(j);
                // If matched, we delegate to the object differ to see WHAT changed inside
                const subChanges = await diffObject(oldItem as any, newItem as any);
                for (const change of subChanges) {
                    events.push({
                        field: prefixField(fieldPrefix, `[${i}].${String(change.field)}`),
                        old_value: change.old_value,
                        new_value: change.new_value,
                        type: change.type,
                    });
                }
                break;
            }
        }
    }
    // 2. Handle Additions (Items in New not matched)
    newArr.forEach((item, index) => {
        if (!matchedNewIndices.has(index)) {
            events.push({
                field: prefixField(fieldPrefix, `[${index}]`),
                old_value: undefined,
                new_value: item as DiffValue,
                type: "addition",
            });
        }
    });
    // 3. Handle Removals (Items in Old not matched)
    oldArr.forEach((item, index) => {
        if (!matchedOldIndices.has(index)) {
            events.push({
                field: prefixField(fieldPrefix, `[${index}]`),
                old_value: item as DiffValue,
                new_value: undefined,
                type: "removal",
            });
        }
    });
    const transformedEvents: ArrayDiffEvent[] = [];
    for (const event of events) {
        transformedEvents.push(await applyTransform<TSchema & object, ArrayDiffEvent, Prefix>(event, options.transform as DiffTransformer<TSchema & object, Prefix>));
    }
    return transformedEvents;
}
