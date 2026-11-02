import { Router } from "express";
import { handleGetInvoiceChangeLogs } from "../controller/changelog";
import { protectRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
const changelogRouter = Router();
changelogRouter.get("/changelog", protectRoute(), handleGetInvoiceChangeLogs);
export default changelogRouter;
