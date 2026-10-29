import { Router } from "express";
import { handleGetViewers, handlePatchViewer, handlePostViewer, sanitizePatchViewerPayload, sanitizePostViewerPayload, } from "../controller/viewers";
import { protectRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
const viewersRouter = Router();
viewersRouter.get("/viewers", protectRoute(), handleGetViewers);
viewersRouter.post("/viewers", protectRoute(), sanitizePostViewerPayload, handlePostViewer);
viewersRouter.patch("/viewers/:id", protectRoute(), sanitizePatchViewerPayload, handlePatchViewer);
export default viewersRouter;
