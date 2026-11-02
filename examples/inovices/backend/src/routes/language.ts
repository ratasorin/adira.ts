import { Router } from "express";
import { handleGetTemplateTranslation,handlePatchTemplateTranslation,handlePostTemplateTranslation,sanitizePatchTemplateTranslationPayload,sanitizePostTemplateTranslationPayload,} from "../controller/languages";
import { protectRoute } from "../middleware/auth";
const languageRouter = Router();
languageRouter.get("/templates", protectRoute(), handleGetTemplateTranslation);
languageRouter.post("/templates", protectRoute(), sanitizePostTemplateTranslationPayload, handlePostTemplateTranslation);
languageRouter.patch("/templates/:id", protectRoute(), sanitizePatchTemplateTranslationPayload, handlePatchTemplateTranslation);
export default languageRouter;
