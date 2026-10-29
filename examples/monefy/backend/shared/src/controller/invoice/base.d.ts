export declare const getInvoices: import("@n/adira.core.ts/dist/helpers/backend").ExecuteGET<import("../../models/invoice/Invoice").IInvoice, {}>;
export declare const postInvoice: import("@n/adira.core.ts/dist/helpers/backend").ExecutePOST<import("../../models/invoice/Invoice").IInvoice>;
export declare const patchInvoice: import("@n/adira.core.ts/dist/helpers/backend").ExecutePATCH<import("../../models/invoice/Invoice").IInvoice>;
export type GetInvoicesFn = typeof getInvoices;
export type PatchInvoiceFn = typeof patchInvoice;
export type PostInvoiceFn = typeof postInvoice;
