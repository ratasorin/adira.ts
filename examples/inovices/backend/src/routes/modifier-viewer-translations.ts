import { Router } from "express";
import { handleGetModifierViewerTranslations,handleUpsertModifierViewerTranslation,} from "../controller/modifier-viewer-translations";
import { protectRoute } from "../middleware/auth";
const modifierViewerTranslationsRouter = Router();
modifierViewerTranslationsRouter.get("/modifier-viewer-translations", protectRoute(), handleGetModifierViewerTranslations);
modifierViewerTranslationsRouter.post("/modifier-viewer-translations", protectRoute(), handleUpsertModifierViewerTranslation);
export default modifierViewerTranslationsRouter;
