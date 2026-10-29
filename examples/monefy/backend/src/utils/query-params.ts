import { PopulateOptions } from "mongoose";
export interface ParsedQuery {
    topLevelFields: string[];
    populateFields: PopulateOptions[];
}
/**
 * Parses `select` and `include` query parameters to build top-level projection
 * and mongoose populate options.
 */
export const parseSelectInclude = (select: string[], include: string[]): ParsedQuery => {
    const topLevelFields = new Set<string>();
    const populateSelectMap = new Map<string, Set<string>>();
    for (const fieldPath of select) {
        const [top, ...rest] = fieldPath.split(".");
        if (!top)
            continue;
        topLevelFields.add(top);
        // only build nested selections if top-level is in include
        if (include.includes(top) && rest.length > 0) {
            if (!populateSelectMap.has(top)) {
                populateSelectMap.set(top, new Set());
            }
            populateSelectMap.get(top)?.add(rest.join("."));
        }
    }
    const populateFields: PopulateOptions[] = include.map((key) => {
        const nestedSelects = populateSelectMap.get(key);
        return {
            path: key,
            select: nestedSelects ? Array.from(nestedSelects).join(" ") : undefined,
        };
    });
    return {
        topLevelFields: Array.from(topLevelFields),
        populateFields,
    };
};
