import { Router } from "express";
import { handleGeneratePdf,handleGeneratePreview } from "../controller/http/generate-invoice-preview";
import { protectRoute } from "../middleware/auth";
const generateRouter = Router();
generateRouter.post("/generate/preview", protectRoute(), handleGeneratePreview);
generateRouter.get("/generate/invoice/:id", protectRoute(), handleGeneratePdf);
export default generateRouter;
