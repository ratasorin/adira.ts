import { Router } from "express";
import { handleGetInvoiceChangeLogs } from "../controller/changelog";
import { protectRoute } from "../middleware/auth";
const changelogRouter = Router();
changelogRouter.get("/changelog", protectRoute(), handleGetInvoiceChangeLogs);
export default changelogRouter;
