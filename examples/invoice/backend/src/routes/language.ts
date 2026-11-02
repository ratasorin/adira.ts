import { Router } from "express";
import { handlePatchTemplateTranslation, handleGetTemplateTranslation, handlePostTemplateTranslation, sanitizePatchTemplateTranslationPayload, sanitizePostTemplateTranslationPayload, } from "../controller/languages";
import { protectRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
const languageRouter = Router();
languageRouter.get("/templates", protectRoute(), handleGetTemplateTranslation);
languageRouter.post("/templates", protectRoute(), sanitizePostTemplateTranslationPayload, handlePostTemplateTranslation);
languageRouter.patch("/templates/:id", protectRoute(), sanitizePatchTemplateTranslationPayload, handlePatchTemplateTranslation);
export default languageRouter;
