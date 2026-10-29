import { type Json } from "../../types/json";
import { Backend } from "@n/adira.core.ts";
import { ErrorResponse } from "../../types";
export declare const getInvoiceChangeLogs: Backend.ExecuteGET<import("../../models/invoice/ChangeLog").IInvoiceChangeLog, {}>;
export type GetInvoiceChangeLogsExecutor = typeof getInvoiceChangeLogs;
