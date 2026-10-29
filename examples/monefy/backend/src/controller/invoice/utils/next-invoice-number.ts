import { BaseInvoice } from "../../../models/invoice/Invoice";

export async function nextInvoiceNumber(counter: number): Promise<number> {
    const taken = await BaseInvoice.find({ index: { $gt: counter } }).sort({ index: 1 }).select({ index: 1 }).lean();
    let next = counter + 1;
    for (const invoice of taken) {
        if (invoice.index === next) next++;
        else if (invoice.index > next) break;
    }
    return next;
}
