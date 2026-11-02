import type { InvoiceInput } from "../types";
import { type Json } from "../../../types/json";
import { Backend } from "@n/adira.core.ts";
import { IInvoiceChangeLog } from "../../../models/invoice/ChangeLog";
import { ErrorResponse } from "../../../types";
import { PatchInvoiceFn } from "../base";
