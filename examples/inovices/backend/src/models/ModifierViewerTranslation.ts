import mongoose, { Document, Schema } from "mongoose";
export type ModifierViewerEntityType = "modifier" | "viewer";
export interface IModifierViewerTranslation {
    _id: string;
    entity_type: ModifierViewerEntityType;
    entity_id: string;
    language_code: string;
    text: string;
}
export const modifierViewerTranslationSchema = new Schema<IModifierViewerTranslation & Document>({
    entity_type: {
        type: String,
        enum: ["modifier", "viewer"],
        required: true,
    },
    entity_id: {
        type: String,
        required: true,
        trim: true,
    },
    language_code: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    text: {
        type: String,
        required: true,
        trim: true,
    },
});
modifierViewerTranslationSchema.index({ entity_type: 1, entity_id: 1, language_code: 1 }, { unique: true });
const ModifierViewerTranslation = mongoose.model<IModifierViewerTranslation & Document>("ModifierViewerTranslation", modifierViewerTranslationSchema);
export default ModifierViewerTranslation;
