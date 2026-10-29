export type ModifierViewerEntityType = "modifier" | "viewer";
export type ModifierViewerTranslation = {
    _id: string;
    entity_type: ModifierViewerEntityType;
    entity_id: string;
    language_code: string;
    text: string;
};
type TranslationPayload = {
    error?: boolean;
    message?: string;
    rows?: ModifierViewerTranslation[];
};
type UpsertTranslationPayload = {
    error?: boolean;
    message?: string;
    _id?: string;
    text?: string;
};
type TranslationResponse = {
    text?: string;
    message?: string;
    language_code?: string;
};
export const fetchModifierViewerTranslations = async ({ entityType, entityIds, languageCode, }: {
    entityType: ModifierViewerEntityType;
    entityIds: string[];
    languageCode: string;
}) => {
    if (!entityIds.length || !languageCode)
        return [];
    const query = new URLSearchParams({
        entity_type: entityType,
        language_code: languageCode,
    });
    entityIds.forEach((entityId) => query.append("entity_ids[]", entityId));
    const response = await fetch(`/api/modifier-viewer-translations?${query.toString()}`, {
        method: "GET",
        credentials: "include",
    });
    const payload = (await response.json()) as TranslationPayload;
    if (!response.ok || payload.error) {
        throw new Error(payload.message || "Unable to load translations");
    }
    return payload?.rows || [];
};
export const saveModifierViewerTranslation = async ({ entityType, entityId, languageCode, text, }: {
    entityType: ModifierViewerEntityType;
    entityId: string;
    languageCode: string;
    text: string;
}) => {
    const response = await fetch(`/api/modifier-viewer-translations`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            language_code: languageCode,
            text,
        }),
    });
    const payload = (await response.json()) as UpsertTranslationPayload;
    if (!response.ok || payload.error || !payload) {
        throw new Error(payload.message || "Unable to save translation");
    }
    return payload;
};
export const translateModifierViewerLabel = async ({ text, sourceLanguageCode, targetLanguageCode, }: {
    text: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
}) => {
    const response = await fetch(`/api/notes-translations/translate`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text,
            source_language_code: sourceLanguageCode,
            target_language_code: targetLanguageCode,
        }),
    });
    const payload = (await response.json()) as TranslationResponse;
    if (!response.ok || !payload.text || !payload.language_code) {
        throw new Error(payload.message || "Unable to translate label");
    }
    return {
        language_code: payload.language_code,
        text: payload.text,
    };
};
