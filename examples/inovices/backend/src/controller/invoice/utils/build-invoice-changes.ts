import { IInvoiceChange } from "../../../models/invoice/ChangeLog";
import { IInvoice } from "../../../models/invoice/Invoice";
import { diffArray, diffObject } from "../../../utils/diff";
import { invoiceChangeTransformer, invoiceObjectChangeTransformer, } from "../invoice-change-transformer";
type InvoiceDiffSource = IInvoice & {
    __v: number;
};
export const buildInvoiceChanges = async (oldInvoice: InvoiceDiffSource, newInvoice: InvoiceDiffSource): Promise<IInvoiceChange[]> => {
    const invoiceDiff = await diffObject<InvoiceDiffSource>(oldInvoice, newInvoice, {
        ignore: [
            "products",
            "viewers",
            "modifiers",
            "total",
            "currency",
            "from_invoice",
            "reporter",
            "_id",
            "version",
            "__v",
        ],
        transform: invoiceObjectChangeTransformer,
    });
    const viewerDiff = await diffArray<NonNullable<IInvoice["viewers"]>[number], "viewers">(newInvoice.viewers || [], oldInvoice.viewers || [], {
        comparator: (a, b) => a._id.toString() === b._id.toString(),
        fieldPrefix: "viewers",
        primaryKey: (viewer) => viewer._id.toString(),
        transform: invoiceChangeTransformer,
    });
    const modifierDiff = await diffArray<NonNullable<IInvoice["modifiers"]>[number], "modifiers">(newInvoice.modifiers || [], oldInvoice.modifiers || [], {
        comparator: (a, b) => a._id.toString() === b._id.toString(),
        fieldPrefix: "modifiers",
        primaryKey: (modifier) => modifier._id.toString(),
        transform: invoiceChangeTransformer,
    });
    const productDiff = await diffArray<NonNullable<IInvoice["products"]>[number], "products">(newInvoice.products || [], oldInvoice.products || [], {
        comparator: (a, b) => a._id.toString() === b._id.toString(),
        fieldPrefix: "products",
        primaryKey: (product) => product._id.toString(),
        transform: invoiceChangeTransformer,
    });
    return [...invoiceDiff, ...viewerDiff, ...modifierDiff, ...productDiff];
};
