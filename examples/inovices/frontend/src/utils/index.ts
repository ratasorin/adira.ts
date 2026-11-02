import z from "zod";
/**
 * Zips two arrays together, then appends the remainder of the longer array.
 * Removes duplicates based on the `cmp` function.
 */
export function zipMerge<T>(arr1: T[], arr2: T[], cmp: (a: T, b: T) => boolean): T[] {
    const result: T[] = [];
    const seen: T[] = [];
    const len = Math.max(arr1.length, arr2.length);
    for (let i = 0; i < len; i++) {
        const pushIfUnique = (item: T) => {
            if (!seen.some((x) => cmp(x, item))) {
                seen.push(item);
                result.push(item);
            }
        };
        if (i < arr1.length)
            pushIfUnique(arr1[i]);
        if (i < arr2.length)
            pushIfUnique(arr2[i]);
    }
    return result;
}
export const checkErrors = (validator: z.ZodTypeAny, value: unknown): string[] => {
    const result = validator.safeParse(value);
    return result.success ? [] : z.treeifyError(result.error).errors;
};
