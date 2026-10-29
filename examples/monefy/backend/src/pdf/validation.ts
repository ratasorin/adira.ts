import { z } from "zod";
const text = z.string().max(1000);
const asset = z.string().max(250);
const currency = z.enum(["EUR", "USD", "RON", "GBP"]);
const date = z.union([z.iso.datetime(), z.iso.date(), z.date()]);
export const previewDraftSchema = z.object({
    issuer_company: z.object({
        _id: z.string().regex(/^[a-f\d]{24}$/i), name: text,
        address: z.object({ country: text, street: text, zip: text, city: text }),
        vat_id: text, contact: z.object({ email: text, phone: text, fax: text, website: text }),
        iban: text, bic: text, bank_name: text, tax_number: text, account_number: text, bank_code: text,
        assets: z.object({ logo: asset, signature: asset, stamp: asset }),
    }).optional(),
    receiving_customer: z.object({ selected_name: text, city: text, country: text, address: text, cif: text }).optional(),
    products: z.array(z.object({ _id: z.string().max(100), quantity: z.number().min(0).max(1000000), product: z.object({ name: text, price: z.number().min(0).max(100000000), currency }) })).max(2000).default([]),
    modifiers: z.array(z.object({ index: z.number().int(), name: text, operation: z.enum(["add", "subtract"]), scope: z.enum(["line", "total"]), type: z.enum(["fixed", "percentage"]), value: z.number().min(0).max(100000000), currency: currency.optional(), targetProductLine: z.array(z.string().max(100)).optional() }).refine(modifier => modifier.type !== "fixed" || modifier.currency !== undefined, { message: "A fixed modifier requires a currency", path: ["currency"] })).max(2000).default([]),
    viewers: z.array(z.object({ index: z.number().int(), name: text })).max(2000).default([]),
    notes: z.string().max(50000).optional(), invoiceNumber: z.number().int().min(0).optional(),
    emittedDate: date.optional(), reportedPeriod: date.optional(), language_id: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict();
