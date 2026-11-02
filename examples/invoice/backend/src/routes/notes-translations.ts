import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { handleTranslateNotes } from "../controller/notes-translations";
import { asyncHandler } from "../middleware/async-handler";
const notesTranslationsRouter = Router();
notesTranslationsRouter.post("/notes-translations/translate", protectRoute(), handleTranslateNotes);
export default notesTranslationsRouter;
