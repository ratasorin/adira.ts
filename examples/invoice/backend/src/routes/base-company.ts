import { Router } from "express";
import { protectRoute } from "../middleware/auth";
import { asyncHandler } from "../middleware/async-handler";
import { handleGetBaseCompany, handlePatchBaseCompany, sanitizePatchBaseCompanyPayload, } from "../controller/base-company";
const baseCompanyRouter = Router();
baseCompanyRouter.get("/base-companies/:id", protectRoute(), handleGetBaseCompany);
baseCompanyRouter.patch("/base-companies/:id", protectRoute(), sanitizePatchBaseCompanyPayload, handlePatchBaseCompany);
export default baseCompanyRouter;
