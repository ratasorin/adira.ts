import { type Json } from "../../types/json";
import { Backend } from "@n/adira.core.ts";
import { ErrorResponse } from "../../types";
declare const baseCompanyGet: Backend.ExecuteGET<import("../../models/Company").IBaseCompany, {}>;
export declare const baseCompanyPatch: Backend.ExecutePATCH<import("../../models/Company").IBaseCompany>;
type GetBaseCompanies = typeof baseCompanyGet;
type PatchBaseCompany = typeof baseCompanyPatch;
