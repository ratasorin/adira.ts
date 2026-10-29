import mongoose, { Document, Model, Schema } from "mongoose";
import { RefTo, Serialize } from "@n/adira.core.ts";
export interface IUser {
    _id: string;
    username: string;
    email: string;
    password: string;
    role: "BASIC" | "ADVANCED";
    isVerified: boolean;
    created_by: Serialize<mongoose.Types.ObjectId, string> & RefTo<IUser>;
    isAdminCreated: boolean;
    deletedAt?: Date | null;
}
export const userSchema = new Schema<IUser & Document>({
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: {
        type: String,
        required: function (): boolean {
            // Require password only if role is not 'admin'
            return !this.isAdminCreated;
        },
    },
    isAdminCreated: {
        type: Boolean,
        default: true,
    },
    role: {
        type: String,
        enum: ["BASIC", "ADVANCED"],
        default: "BASIC",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    deletedAt: { type: Date, default: null },
});
const User = mongoose.model<IUser & Document>("User", userSchema);
export default User;
