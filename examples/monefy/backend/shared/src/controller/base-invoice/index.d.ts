import { type Json } from "../../types/json";
import { ErrorResponse } from "../../types";
import { Backend } from "@n/adira.core.ts";
declare const baseInvoiceGet: Backend.ExecuteGET<import("../../models/invoice/Invoice").IBaseInvoice, {}>;
export declare const baseInvoicePost: Backend.ExecutePOST<import("../../models/invoice/Invoice").IBaseInvoice>;
type GetBaseInvoices = typeof baseInvoiceGet;
type PostBaseInvoice = typeof baseInvoicePost;
