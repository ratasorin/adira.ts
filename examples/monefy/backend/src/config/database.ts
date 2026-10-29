import mongoose from "mongoose";
import { config } from "./env";
export default async function connectDB() {
    await mongoose.connect(config.mongo, { serverSelectionTimeoutMS: 5000 });
    console.log("Monefy database connected");
}
