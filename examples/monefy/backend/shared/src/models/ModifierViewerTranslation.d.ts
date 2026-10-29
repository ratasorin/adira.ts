export type ModifierViewerEntityType = "modifier" | "viewer";
export interface IModifierViewerTranslation {
    _id: string;
    entity_type: ModifierViewerEntityType;
    entity_id: string;
    language_code: string;
    text: string;
}
