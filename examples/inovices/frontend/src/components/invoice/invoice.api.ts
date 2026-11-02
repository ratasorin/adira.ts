import { expectSuccess, expectExecutor } from "../../services/api";
import { api } from "../../services/api";
import axios from "axios";
import type { InvoiceDraft } from "@inovices/types/src/controller/invoice/types/index";

export const fetchInvoicePdfPreview = async (params: InvoiceDraft, signal?: AbortSignal) => {
    const response = await axios.post<ArrayBuffer>("/api/generate/preview", params, { signal, responseType: "arraybuffer" });
    return response.data;
};

export const fetchInvoice = async (invoiceId: string) => {
    const { run } = api("/invoices", "GET")({
        query: {
            include: [
                "issuer_company",
                "receiving_customer",
                "base_invoice",
                "language",
                                "modifiers.modifier",
                "viewers.viewer",
            ],
            where: { _id: { $eq: invoiceId } },
            rows: r => r({
                select: [] as []
            })
        },
    });
    return run().then(expectSuccess).then(expectExecutor).then((res) => {
        const invoice = res?.rows[0];
        if (!invoice)
            return undefined;
        return {
            ...invoice,
            reported_period: new Date(invoice.reported_period),
            emitted_date: new Date(invoice.emitted_date),
        };
    });
};
