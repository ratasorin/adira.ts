import { Router } from "express";
import { handleGetModifiers,handlePatchModifier,handlePostModifier,sanitizePatchModifierPayload,sanitizePostModifierPayload,} from "../controller/modifiers";
import { protectRoute } from "../middleware/auth";
const modifiersRouter = Router();
modifiersRouter.get("/modifiers", protectRoute(), handleGetModifiers);
modifiersRouter.post("/modifiers", protectRoute(), sanitizePostModifierPayload, handlePostModifier);
modifiersRouter.patch("/modifiers/:id", protectRoute(), sanitizePatchModifierPayload, handlePatchModifier);
export default modifiersRouter;
