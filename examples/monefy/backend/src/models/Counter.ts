import { Schema, model, Document } from "mongoose";
export interface CounterDocument {
    scope: string;
    value: number;
}
const CounterSchema = new Schema<CounterDocument & Document>({
    scope: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
});
export const Counter = model<CounterDocument & Document>("Counter", CounterSchema);
