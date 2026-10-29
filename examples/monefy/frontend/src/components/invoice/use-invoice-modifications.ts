import { useMemo } from "react";
import { useInvoice } from "./use-invoice";
import { useInvoiceOperations } from "./store/operations";
import { useProductsLines } from "./store/products";
type InvoiceDraftSnapshot = {
    emittedDate: Date | string | null | undefined;
    issuerCompanyId: string;
    languageId: string;
    modifiers: Array<{
        _id: string;
        modifier: string;
        index: number;
        targetProductLine?: string[];
    }>;
    notes: string;
    products: Array<{
        _id: string;
        product: string;
        quantity: number;
        index: number;
    }>;
    receivingCustomerId: string;
    reportedPeriod: Date | string | null | undefined;
    viewers: Array<{
        _id: string;
        viewer: string;
        index: number;
    }>;
};
const getEntityId = (value?: string | {
    _id?: string;
} | null) => typeof value === "string" ? value : value?._id || "";
const getDateSnapshotValue = (date?: Date | string | null) => {
    if (!date)
        return "";
    const parsed = date instanceof Date ? date : new Date(date);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};
const sortByIndex = <T extends {
    index?: number;
    _id?: string;
}>(rows: T[]) => [...rows].sort((left, right) => {
    const indexDiff = (left.index ?? 0) - (right.index ?? 0);
    if (indexDiff !== 0)
        return indexDiff;
    return String(left._id || "").localeCompare(String(right._id || ""));
});
const buildInvoiceSnapshot = ({ emittedDate, issuerCompanyId, languageId, modifiers, notes, products, receivingCustomerId, reportedPeriod, viewers, }: InvoiceDraftSnapshot) => ({
    emittedDate: getDateSnapshotValue(emittedDate),
    issuerCompanyId,
    languageId,
    notes: notes || "",
    products: sortByIndex(products).map((row) => ({
        _id: row._id || "",
        product: row.product || "",
        quantity: Number(row.quantity || 0),
        index: Number(row.index || 0),
    })),
    receivingCustomerId,
    reportedPeriod: getDateSnapshotValue(reportedPeriod),
    modifiers: sortByIndex(modifiers).map((row) => ({
        _id: row._id || "",
        modifier: row.modifier || "",
        index: Number(row.index || 0),
        targetProductLine: [...(row.targetProductLine || [])].sort(),
    })),
    viewers: sortByIndex(viewers).map((row) => ({
        _id: row._id || "",
        viewer: row.viewer || "",
        index: Number(row.index || 0),
    })),
});
export const useInvoiceModifications = () => {
    const { company, customer, emittedDate, invoice, invoiceId, languageId, notes, reportedPeriod, } = useInvoice();
    const { rows: productLines } = useProductsLines();
    const operationLines = useInvoiceOperations((state) => state.rows);
    const modifierLines = useMemo(() => operationLines.filter((row) => row.kind === "modifier"), [operationLines]);
    const viewerLines = useMemo(() => operationLines.filter((row) => row.kind === "viewer"), [operationLines]);
    const productsPayload = useMemo(() => productLines
        .filter((row) => row.product?._id)
        .map((row) => ({
        _id: row._id,
        product: row.product!._id,
        quantity: row.quantity,
        index: row.index,
    })), [productLines]);
    const modifiersPayload = useMemo(() => modifierLines.map((row) => ({
        _id: row._id,
        modifier: row.modifier._id,
        index: row.index,
        targetProductLine: row.targetProductLine,
    })), [modifierLines]);
    const viewersPayload = useMemo(() => viewerLines.map((row) => ({
        _id: row._id,
        viewer: row.viewer._id,
        index: row.index,
    })), [viewerLines]);
    const currentInvoiceSnapshot = useMemo(() => buildInvoiceSnapshot({
        emittedDate,
        issuerCompanyId: company?._id || "",
        languageId,
        modifiers: modifiersPayload,
        notes,
        products: productsPayload,
        receivingCustomerId: customer?._id || "",
        reportedPeriod,
        viewers: viewersPayload,
    }), [
        company?._id,
        customer?._id,
        emittedDate,
        languageId,
        modifiersPayload,
        notes,
        productsPayload,
        reportedPeriod,
        viewersPayload,
    ]);
    const loadedInvoiceSnapshot = useMemo(() => {
        if (!invoice)
            return null;
        return buildInvoiceSnapshot({
            emittedDate: invoice.emitted_date,
            issuerCompanyId: getEntityId(invoice.issuer_company),
            languageId: getEntityId(invoice.language),
            modifiers: (invoice.modifiers || []).map((row) => ({
                _id: row._id,
                modifier: getEntityId(row.modifier),
                index: row.index,
                targetProductLine: row.targetProductLine || [],
            })),
            notes: invoice.notes || "",
            products: (invoice.products || []).map((row) => ({
                _id: row._id,
                product: getEntityId(row.product),
                quantity: row.quantity,
                index: row.index,
            })),
            receivingCustomerId: getEntityId(invoice.receiving_customer),
            reportedPeriod: invoice.reported_period,
            viewers: (invoice.viewers || []).map((row) => ({
                _id: row._id,
                viewer: getEntityId(row.viewer),
                index: row.index,
            })),
        });
    }, [invoice]);
    const hasInvoiceModifications = useMemo(() => {
        if (!invoiceId || !loadedInvoiceSnapshot)
            return true;
        return (JSON.stringify(currentInvoiceSnapshot) !==
            JSON.stringify(loadedInvoiceSnapshot));
    }, [currentInvoiceSnapshot, invoiceId, loadedInvoiceSnapshot]);
    return {
        currentInvoiceSnapshot,
        loadedInvoiceSnapshot,
        hasInvoiceModifications,
        productLines,
        modifierLines,
        viewerLines,
        productsPayload,
        modifiersPayload,
        viewersPayload,
    };
};
