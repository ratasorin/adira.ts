import { Serialize } from "@n/adira.core.ts";
import mongoose, { Document, Schema } from "mongoose";
export interface ISupportedLanguage {
    _id: string;
    code: string; // e.g., "en", "fr", "de"
    name: string; // e.g., "English", "French"
}
const supportedLanguageSchema = new Schema<ISupportedLanguage & Document>({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
});
const SupportedLanguage = mongoose.model<ISupportedLanguage & Document>("SupportedLanguage", supportedLanguageSchema);
export default SupportedLanguage;
