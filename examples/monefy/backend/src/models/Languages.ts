import { Serialize } from "@n/adira.core.ts";
import mongoose, { Document, Schema } from "mongoose";
export interface ILanguage {
    _id: string;
    code: string; // e.g., "en", "fr", "de"
    name: string; // e.g., "English", "French"
}
const languageSchema = new Schema<ILanguage & Document>({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
});
const Languages = mongoose.model<ILanguage & Document>("Languages", languageSchema);
export default Languages;
