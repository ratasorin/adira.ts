import { Serialize } from "@n/adira.core.ts";
import mongoose, { Document } from "mongoose";
export interface IViewer {
    _id: string;
    name: string;
}
export const viewerSchema = new mongoose.Schema<IViewer & Document>({
    name: { type: String, required: true, unique: true },
});
const Viewer = mongoose.model<IViewer & Document>("Viewer", viewerSchema);
export default Viewer;
