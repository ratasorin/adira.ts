import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { handleGetModifierViewerTranslations, handleUpsertModifierViewerTranslation, } from "../controller/modifier-viewer-translations";
import { asyncHandler } from "../middleware/async-handler";
const modifierViewerTranslationsRouter = Router();
modifierViewerTranslationsRouter.get("/modifier-viewer-translations", protectRoute(), handleGetModifierViewerTranslations);
modifierViewerTranslationsRouter.post("/modifier-viewer-translations", protectRoute(), handleUpsertModifierViewerTranslation);
export default modifierViewerTranslationsRouter;
