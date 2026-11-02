import { Router } from "express";
import { handleFileUpload,upload } from "../controller/http/upload";
import { protectRoute } from "../middleware/auth";
const uploadRouter = Router();
uploadRouter.post("/upload", protectRoute(), upload.single("file"), handleFileUpload);
export default uploadRouter;
