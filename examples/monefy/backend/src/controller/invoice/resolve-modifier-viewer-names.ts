import ModifierViewerTranslation, { ModifierViewerEntityType, } from "../../models/ModifierViewerTranslation";
export type ModifierViewerNameEntry = {
    entityType: ModifierViewerEntityType;
    entityId: string;
    fallbackName: string;
};
export type ResolvedModifierViewerName = {
    text: string;
    hasTranslation: boolean;
};
export const DEFAULT_MODIFIER_VIEWER_LANGUAGE_CODE = "en";
export const buildModifierViewerTranslationKey = (entityType: ModifierViewerEntityType, entityId: string) => `${entityType}:${entityId}`;
export const resolveModifierViewerNames = async ({ entries, languageCode, }: {
    entries: ModifierViewerNameEntry[];
    languageCode?: string;
}) => {
    const fallbackMap = new Map<string, ResolvedModifierViewerName>();
    for (const entry of entries) {
        fallbackMap.set(buildModifierViewerTranslationKey(entry.entityType, entry.entityId), {
            text: entry.fallbackName,
            hasTranslation: false,
        });
    }
    const normalizedLanguageCode = String(languageCode || "")
        .trim()
        .toLowerCase();
    if (entries.length === 0 ||
        !normalizedLanguageCode ||
        normalizedLanguageCode === DEFAULT_MODIFIER_VIEWER_LANGUAGE_CODE) {
        return fallbackMap;
    }
    const entityIdsByType = entries.reduce<Record<ModifierViewerEntityType, string[]>>((acc, entry) => {
        acc[entry.entityType].push(entry.entityId);
        return acc;
    }, { modifier: [], viewer: [] });
    const query: Array<{
        entity_type: ModifierViewerEntityType;
        entity_id: {
            $in: string[];
        };
    }> = [];
    if (entityIdsByType.modifier.length > 0) {
        query.push({
            entity_type: "modifier",
            entity_id: { $in: entityIdsByType.modifier },
        });
    }
    if (entityIdsByType.viewer.length > 0) {
        query.push({
            entity_type: "viewer",
            entity_id: { $in: entityIdsByType.viewer },
        });
    }
    if (query.length === 0) {
        return fallbackMap;
    }
    const translations = await ModifierViewerTranslation.find({
        language_code: normalizedLanguageCode,
        $or: query,
    }).lean();
    for (const translation of translations) {
        fallbackMap.set(buildModifierViewerTranslationKey(translation.entity_type, String(translation.entity_id)), {
            text: translation.text,
            hasTranslation: true,
        });
    }
    return fallbackMap;
};
