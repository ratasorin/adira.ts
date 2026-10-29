import "dotenv/config";
export const development = process.env.NODE_ENV === "development";
export const config = {
    port: Number(process.env.PORT || 5000),
    mongo: process.env.MONGO_URI || "mongodb://mongo:27017/monefy",
    redis: process.env.REDIS_URL || "redis://redis:6379",
    rabbit: process.env.RABBITMQ_URL || "amqp://monefy:monefy-local@rabbitmq:5672",
    artifactDir: process.env.PDF_ARTIFACT_DIR || "/data/previews",
    cacheSeconds: Number(process.env.PDF_CACHE_SECONDS || 86400),
    jwt: process.env.JWT_SECRET || "",
    publicOrigin: process.env.PUBLIC_ORIGIN || "http://localhost:8080",
};
export function assertConfiguration() {
    if (config.jwt.length < 32)
        throw new Error("JWT_SECRET must contain at least 32 characters");
    if (!development && config.jwt.includes("local-development"))
        throw new Error("Set a unique JWT_SECRET for production");
    if (!Number.isInteger(config.cacheSeconds) || config.cacheSeconds < 60)
        throw new Error("PDF_CACHE_SECONDS must be at least 60");
}
