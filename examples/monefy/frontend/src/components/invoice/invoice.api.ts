import { expectSuccess } from "../../services/api";
import { api } from "../../services/api";
import axios from "axios";
import { awaitPdf } from "../../services/pdf";
import type { PreviewJobResponse } from "@monefy/types/src/pdf/contracts";
import type { InvoiceDraft } from "@monefy/types/src/controller/invoice/types/index";

export const fetchInvoicePdfPreview = async (params: InvoiceDraft, signal?: AbortSignal) => {
    const job = await axios.post<PreviewJobResponse>("/api/generate/preview", params, { signal });
    return awaitPdf(job.data, signal);
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
    return run().then(expectSuccess).then((res) => {
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
