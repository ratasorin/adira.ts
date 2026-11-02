import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, } from "react";
import { useSearchParams } from "react-router-dom";
import { INVOICE_ID_SEARCH_PARAMS_KEY } from "../../constants";
import { fetchInvoice } from "./invoice.api";
import type { Invoice } from "./invoice.types";
const useInvoiceState = () => {
    const [searchParams] = useSearchParams();
    const [invoiceId, setInvoiceId] = useState<string | undefined>();
    const [invoice, setInvoice] = useState<Invoice | undefined>();
    useEffect(() => {
        setInvoiceId(searchParams.get(INVOICE_ID_SEARCH_PARAMS_KEY) || "");
    }, [searchParams]);
    useEffect(() => {
        if (!invoiceId) {
            setInvoice(undefined);
            return;
        }
        let cancelled = false;
        fetchInvoice(invoiceId).then((invoice) => {
            if (!cancelled && invoice) {
                setInvoice(invoice);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [invoiceId]);
    const [company, setCompany] = useState<Invoice["issuer_company"] | undefined>();
    const [customer, setCustomer] = useState<Invoice["receiving_customer"] | undefined>();
    const [reportedPeriod, setReportedPeriod] = useState<Date | undefined>(undefined);
    const [emittedDate, setEmittedDate] = useState(new Date());
    const [initialProductLines, setInitialProductLines] = useState<Invoice["products"]>([]);
    const [initialModifierLines, setInitialModifierLines] = useState<Invoice["modifiers"]>([]);
    const [initialViewerLines, setInitialViewerLines] = useState<Invoice["viewers"]>([]);
    const [notes, setNotes] = useState<string>("");
    const [languageId, setLanguageId] = useState<string>("");
    const [currentLanguageId, setCurrentLanguageId] = useState<string>("");
    const [currentLanguageCode, setCurrentLanguageCode] = useState<string>("");
    const [total, setTotal] = useState<number>(0);
    const [invoiceNumber, setInvoiceNumber] = useState<number>(0);
    const [baseInvoiceId, setBaseInvoiceId] = useState<string>("");
    const resetAllFields = useCallback(() => {
        setCompany(undefined);
        setCustomer(undefined);
        setEmittedDate(new Date());
        setReportedPeriod(undefined);
        setInitialProductLines([]);
        setInitialModifierLines([]);
        setInitialViewerLines([]);
        setNotes("");
        setLanguageId("");
        setCurrentLanguageId("");
        setCurrentLanguageCode("");
        setInvoiceNumber(0);
        setTotal(0);
        setBaseInvoiceId("");
    }, []);
    const setAllFields = useCallback((invoice: Invoice) => {
        setCompany(invoice.issuer_company || undefined);
        if (invoice.receiving_customer) {
            setCustomer({
                ...invoice.receiving_customer,
                base_customer: invoice.receiving_customer.base_customer,
            });
        }
        else {
            console.error("[Error]");
        }
        setEmittedDate(new Date(invoice.emitted_date));
        setReportedPeriod(invoice.reported_period);
        setInvoiceNumber(invoice.base_invoice?.index || 0);
        setBaseInvoiceId(typeof invoice.base_invoice === "string"
            ? invoice.base_invoice
            : invoice.base_invoice?._id || "");
        setInitialModifierLines(invoice.modifiers);
        setInitialViewerLines(invoice.viewers);
        setInitialProductLines(invoice.products);
        setNotes(invoice.notes);
        const currentLanguage = typeof invoice.language === "string" ? null : invoice.language;
        setLanguageId(currentLanguage?._id || "");
        setCurrentLanguageId(currentLanguage?._id || "");
        setCurrentLanguageCode(currentLanguage?.code || "");
        setTotal(invoice.total);
    }, []);
    useEffect(() => {
        if (!invoice) {
            resetAllFields();
        }
        else {
            setAllFields(invoice);
        }
    }, [invoice, resetAllFields, setAllFields]);
    return {
        invoiceId,
        setInvoiceId,
        invoice,
        emittedDate,
        setEmittedDate,
        company,
        setCompany,
        customer,
        setCustomer,
        reportedPeriod,
        setReportedPeriod,
        invoiceNumber,
        setInvoiceNumber,
        baseInvoiceId,
        initialProductLines,
        initialModifierLines,
        initialViewerLines,
        total,
        notes,
        setNotes,
        setLanguageId,
        languageId,
        currentLanguageId,
        currentLanguageCode,
        resetAllFields,
    };
};
type InvoiceContextValue = ReturnType<typeof useInvoiceState>;
const InvoiceContext = createContext<InvoiceContextValue | null>(null);
export function InvoiceProvider({ children }: {
    children: ReactNode;
}) {
    const value = useInvoiceState();
    return (<InvoiceContext.Provider value={value}>{children}</InvoiceContext.Provider>);
}
export function useInvoice() {
    const value = useContext(InvoiceContext);
    if (!value) {
        throw new Error("useInvoice must be used inside InvoiceProvider");
    }
    return value;
}
