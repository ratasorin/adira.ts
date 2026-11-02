import "dotenv/config";
import { resolve } from "node:path";
export const development = (process.env.NODE_ENV || "development") === "development";
export const config = {
    port: Number(process.env.PORT || 5001),
    mongo: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/inovices_old_adira",
    dataDir: resolve(process.env.INOVICES_DATA_DIR || ".data"),
    jwt: process.env.JWT_SECRET || "inovices-local-demo-secret-for-development-only",
    publicOrigin: process.env.PUBLIC_ORIGIN || "http://localhost:5173",
};
export function assertConfiguration() {
    if (config.jwt.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
}
