import { useEffect, useMemo, useState } from "react";
import { fetchInvoicePdfPreview } from "./invoice.api";
import { useInvoice } from "./invoice-provider";
import { useInvoiceOperations } from "./store/operations";
import { useInvoiceModifications } from "./use-invoice-modifications";
const DEBOUNCE_TIMEOUT = 400;
type UseInvoicePreviewParams = {
    assignedInvoiceNumber: number;
};
export function useInvoicePreview({ assignedInvoiceNumber, }: UseInvoicePreviewParams) {
    const { company, customer, emittedDate, invoiceNumber, languageId, notes, reportedPeriod, } = useInvoice();
    const modifierDisplayById = useInvoiceOperations((state) => state.modifierDisplayById);
    const viewerDisplayById = useInvoiceOperations((state) => state.viewerDisplayById);
    const { productLines, modifierLines, viewerLines } = useInvoiceModifications();
    const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        const timer = window.setTimeout(() => {
            fetchInvoicePdfPreview({
                issuer_company: company?.details
                    ? {
                        ...company?.details,
                        name: company?.name || "",
                        _id: company?._id || "",
                    }
                    : undefined,
                receiving_customer: customer?.details,
                products: productLines
                    .filter((row) => row.product)
                    .map((row) => ({
                    _id: row._id,
                    product: {
                        currency: row.product!.details.currency,
                        name: row.product!.name,
                        price: row.product!.details.unit_price,
                    },
                    quantity: row.quantity,
                })),
                emittedDate,
                invoiceNumber: assignedInvoiceNumber || invoiceNumber,
                language_id: languageId || undefined,
                modifiers: modifierLines.map((row) => {
                    const base = {
                        index: row.index,
                        name: modifierDisplayById[row.modifier._id]?.displayName || row.modifier.name,
                        operation: row.modifier.operation,
                        scope: row.modifier.scope,
                        value: row.modifier.value,
                        targetProductLine: row.targetProductLine,
                    };
                    return row.modifier.type === "fixed"
                        ? { ...base, type: "fixed" as const, currency: row.modifier.currency || "EUR" }
                        : { ...base, type: "percentage" as const };
                }),
                notes,
                reportedPeriod,
                viewers: viewerLines.map((row) => ({
                    index: row.index,
                    name: viewerDisplayById[row.viewer._id]?.displayName || row.viewer.name,
                })),
            }, controller.signal).then((invoicePreview) => {
                if (!controller.signal.aborted) setPdfData(invoicePreview);
            }).catch((err: Error) => {
                if (!controller.signal.aborted) setError(err.message || "Could not generate preview");
            }).finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        }, DEBOUNCE_TIMEOUT);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [
        assignedInvoiceNumber,
        company,
        customer,
        emittedDate,
        invoiceNumber,
        languageId,
        modifierDisplayById,
        modifierLines,
        notes,
        productLines,
        reportedPeriod,
        viewerDisplayById,
        viewerLines,
    ]);
    const formattedPdfData = useMemo(() => (pdfData ? new Uint8Array(pdfData) : null), [pdfData]);
    return {
        formattedPdfData,
        error,
        loading,
        pdfData,
    };
}
