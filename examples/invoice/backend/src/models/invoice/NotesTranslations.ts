import mongoose, { Document, Schema } from "mongoose";
export interface INotesTranslation {
    _id: string;
    hash: string; // sha256 of the original notes text
    language_code: string; // e.g. "en", "de"
    text: string;
    createdAt?: Date;
    updatedAt?: Date;
}
const notesTranslationSchema = new Schema<INotesTranslation & Document>({
    hash: { type: String, required: true, index: true },
    language_code: { type: String, required: true, index: true },
    text: { type: String, required: true },
}, { timestamps: true });
notesTranslationSchema.index({ hash: 1, language_code: 1 }, { unique: true });
const NotesTranslation = mongoose.model<INotesTranslation & Document>("NotesTranslation", notesTranslationSchema);
export default NotesTranslation;
