import { Router } from "express";
import { handleTranslateNotes } from "../controller/notes-translations";
import { protectRoute } from "../middleware/auth";
const notesTranslationsRouter = Router();
notesTranslationsRouter.post("/notes-translations/translate", protectRoute(), handleTranslateNotes);
export default notesTranslationsRouter;
