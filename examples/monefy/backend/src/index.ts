import "./config/env";
import "express-async-errors";
import "./config/query-casting";
import { errorHandler } from "./middleware/error-handler";
import { type Json, json } from "./types/json";
import { assetsDirectory } from "./utils/assets";
import { decodeApiQuery } from "./middleware/query";
import baseCompanyRouter from "./routes/base-company";
import baseInvoiceRouter from "./routes/base-invoice";
import changelogRouter from "./routes/changelog";
import generateRouter from "./routes/generate-invoice-preview";
import languageRouter from "./routes/language";
import translationsRouter from "./routes/modifier-viewer-translations";
import modifiersRouter from "./routes/modifiers";
import notesTranslationsRouter from "./routes/notes-translations";
import uploadRouter from "./routes/upload";
import usersRouter from "./routes/users";
import viewersRouter from "./routes/viewers";
import express, { type Request, type Response, type NextFunction, } from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { config, assertConfiguration } from "./config/env";
import connectDB from "./config/database";
import { connectServices, closeServices, redis, channel, QUEUE, } from "./pdf/connections";
import { protectRoute } from "./middleware/auth";
import { authRouter } from "./routes/auth";
import invoiceRouter from "./routes/invoice";
import companyRouter from "./routes/company";
import productsRouter from "./routes/products";
import customerRouter from "./routes/customer";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.set("json replacer", (key: string, value: unknown) => key === "password" ? undefined : value);
app.use(decodeApiQuery);
app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});
const health = (_req: Request<never, never, {}, {}>, res: Response<Json<{
    status: string;
}>>) => {
    res.json(json({ status: "ok" }));
};
const readiness = async (_req: Request<never, never, {}, {}>, res: Response<Json<{
    status: string;
}>>) => {
    try {
        if (mongoose.connection.readyState !== 1)
            throw new Error("Database unavailable");
        await redis.ping();
        await channel.checkQueue(QUEUE);
        const workers = await redis.keys("monefy:worker:*");
        if (!workers.length)
            throw new Error("Worker unavailable");
        res.json(json({ status: "ready" }));
    }
    catch {
        res.status(503).json(json({ status: "unavailable" }));
    }
};
const apiRouter = express.Router();
apiRouter.get("/health", health);
apiRouter.get("/health/ready", readiness);
apiRouter.use(authRouter);
apiRouter.use(invoiceRouter);
apiRouter.use(companyRouter);
apiRouter.use(productsRouter);
apiRouter.use(customerRouter);
apiRouter.use(baseCompanyRouter);
apiRouter.use(baseInvoiceRouter);
apiRouter.use(changelogRouter);
apiRouter.use(generateRouter);
apiRouter.use(languageRouter);
apiRouter.use(translationsRouter);
apiRouter.use(modifiersRouter);
apiRouter.use(notesTranslationsRouter);
apiRouter.use(uploadRouter);
apiRouter.use(usersRouter);
apiRouter.use(viewersRouter);
const brandIcon = (_req: Request<never, never, {}, {}>, res: Response<Json<any>>) => {
    res
        .type("svg")
        .send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#598c75"/><text x="9" y="29" font-family="sans-serif" font-size="28" font-weight="bold" fill="white">m</text></svg>');
};
apiRouter.get("/assets/icon.svg", brandIcon);
const staticAssets = express.static(assetsDirectory);
const assetRoute = "/assets";
apiRouter.use(assetRoute, protectRoute(), staticAssets);
// Declare route paths in their routers and apply the transport prefix once.
app.use("/api", apiRouter);
app.use((_req, res) => {
    res.status(404).json(json({ message: "Route not found" }));
});
app.use(errorHandler);
async function main() {
    assertConfiguration();
    await connectDB();
    await connectServices();
    const server = app.listen(config.port, "0.0.0.0", () => console.log(`Monefy API listening on ${config.port}`));
    for (const signal of ["SIGTERM", "SIGINT"])
        process.on(signal, () => {
            server.close(async () => {
                await closeServices();
                await mongoose.disconnect();
                process.exit(0);
            });
            setTimeout(() => process.exit(1), 20000).unref();
        });
}
if (require.main === module)
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
