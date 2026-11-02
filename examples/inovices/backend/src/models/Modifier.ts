import { Schema, model, Document, Types } from "mongoose";
import { Currency } from "./Product";
export interface IModifier {
    _id: string;
    name: string;
    scope: "line" | "total";
    type: "percentage" | "fixed";
    operation: "add" | "subtract";
    value: number;
    currency?: Currency;
}
export const modifierSchema = new Schema<IModifier & Document>({
    name: { type: String, required: true },
    scope: {
        type: String,
        enum: ["total", "line"],
        required: true,
    },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    operation: { type: String, enum: ["add", "subtract"], required: true },
    value: { type: Number, required: true },
    currency: {
        type: String,
        enum: ["EUR", "USD", "RON", "GBP"],
        required: false,
    },
});
// Custom validation: when type is "fixed", currency must be present
modifierSchema.pre("validate", function (next) {
    if (this.type === "fixed" && !this.currency) {
        this.invalidate("currency", "Currency is required when type is 'fixed'");
    }
    next();
});
// Composite unique index: allows multiple modifiers with same key but different currencies
modifierSchema.index({ name: 1, scope: 1, type: 1, operation: 1, value: 1, currency: 1 }, {
    unique: true,
    partialFilterExpression: {
        name: { $exists: true },
    },
});
const Modifier = model<IModifier & Document>("Modifier", modifierSchema);
export default Modifier;
