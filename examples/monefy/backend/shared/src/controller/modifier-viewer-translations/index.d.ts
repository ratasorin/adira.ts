import { type Json } from "../../types/json";
import { IModifierViewerTranslation } from "../../models/ModifierViewerTranslation";
import { ErrorResponse } from "../../types";
type GetTranslationsQuery = {
    entity_type?: string;
    entity_ids?: string | string[];
    "entity_ids[]"?: string | string[];
    language_code?: string;
};
type UpsertTranslationBody = {
    entity_type?: string;
    entity_id?: string;
    language_code?: string;
    text?: string;
};
