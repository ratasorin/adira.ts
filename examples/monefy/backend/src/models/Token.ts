import { RefTo, Serialize } from "@n/adira.core.ts";
import mongoose, { Document, Schema } from "mongoose";
import { IUser } from "./User";
export interface IToken {
    _id: string;
    user: Serialize<mongoose.Types.ObjectId, string> & RefTo<IUser>;
    token: string;
    purpose: "verify" | "reset" | "invite";
    isUsed: boolean;
    createdAt: Date;
}
export const tokenSchema = new Schema<IToken & Document>({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["verify", "reset", "invite"], required: true },
    token: { type: String, required: true, unique: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: "1d" }, // Auto-delete after 1 day
});
const Token = mongoose.model<IToken & Document>("Token", tokenSchema);
export default Token;
