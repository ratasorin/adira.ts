import type { fetchInvoice } from "./invoice.api";
export type VIEW_MODE = "read" | "edit";
export type DraftInvoiceAllocationScope = "local" | "global";
export type InvoiceNumberAvailabilityStatus = "idle" | "checking" | "available" | "taken";
export type Invoice = NonNullable<Awaited<ReturnType<typeof fetchInvoice>>>;
