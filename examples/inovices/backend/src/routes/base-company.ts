import { Router } from "express";
import { handleGetBaseCompany,handlePatchBaseCompany,sanitizePatchBaseCompanyPayload,} from "../controller/base-company";
import { protectRoute } from "../middleware/auth";
const baseCompanyRouter = Router();
baseCompanyRouter.get("/base-companies/:id", protectRoute(), handleGetBaseCompany);
baseCompanyRouter.patch("/base-companies/:id", protectRoute(), sanitizePatchBaseCompanyPayload, handlePatchBaseCompany);
export default baseCompanyRouter;
