import cookieParser from "cookie-parser";
import express from "express";
import "express-async-errors";
import mongoose from "mongoose";
import connectDB from "./config/database";
import "./config/env";
import { assertConfiguration,config } from "./config/env";
import "./config/query-casting";
import { brandIcon,health,readiness } from "./controller/http/system";
import { protectRoute } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { decodeApiQuery } from "./middleware/query";
import { authRouter } from "./routes/auth";
import baseCompanyRouter from "./routes/base-company";
import baseInvoiceRouter from "./routes/base-invoice";
import changelogRouter from "./routes/changelog";
import companyRouter from "./routes/company";
import customerRouter from "./routes/customer";
import generateRouter from "./routes/generate-invoice-preview";
import invoiceRouter from "./routes/invoice";
import languageRouter from "./routes/language";
import translationsRouter from "./routes/modifier-viewer-translations";
import modifiersRouter from "./routes/modifiers";
import notesTranslationsRouter from "./routes/notes-translations";
import productsRouter from "./routes/products";
import uploadRouter from "./routes/upload";
import usersRouter from "./routes/users";
import viewersRouter from "./routes/viewers";
import { json } from "./types/json";
import { assetsDirectory } from "./utils/assets";
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
    const server = app.listen(config.port, "127.0.0.1", () => console.log(`Inovices API listening on ${config.port}`));
    for (const signal of ["SIGTERM", "SIGINT"])
        process.on(signal, () => {
            server.close(async () => {
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
