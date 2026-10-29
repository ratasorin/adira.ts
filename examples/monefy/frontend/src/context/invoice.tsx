import { expectSuccess } from "../services/api";
import { createContext, useContext, useState, ReactNode, useEffect, Dispatch, SetStateAction, useCallback, } from "react";
import { api } from "../services/api";
import { getBaseCompanyId } from "../utils/company";
type InvoiceContextType = {
    invoices: PopulatedInvoice[];
    invoiceIdsByIssuer: Record<string, string[]>;
    setFilters: Dispatch<SetStateAction<Filter>>;
    fetchInvoices: () => Promise<PopulatedInvoice[] | undefined>;
    addInvoice: (newInvoice: PopulatedInvoice) => void;
};
export type PopulatedInvoice = NonNullable<Awaited<ReturnType<typeof getFilteredInvoices>>>[number];
export type Filter = {
    companyNames?: string[];
    customerNames?: string[];
    emittedBetween?: {
        start?: Date;
        end?: Date;
    };
};
const getInvoiceIdsByIssuer = async () => {
    return api("/invoice-groups/by-issuer", "GET")({query: {}, }).run().then(expectSuccess).then((res) => res?.groups);
};
export const getFilteredInvoices = async ({ companyNames, customerNames, emittedBetween, invoiceIds, }: Filter & {
    invoiceIds?: string[];
}) => {
    if (invoiceIds && invoiceIds.length === 0) {
        return [];
    }
    const invoices = await api("/invoices", "GET")({
        query: {
            include: [
                "base_invoice",
                "issuer_company",
                "modifiers.modifier",
                "products.product",
                "receiving_customer",
                "reporter",
                "viewers.viewer",
            ],
            where: {
                ...(invoiceIds ? { _id: { $in: invoiceIds } } : {}),
                ...(companyNames?.length ? { "issuer_company.name": { $in: companyNames } } : {}),
                ...(customerNames?.length ? { "receiving_customer.details.selected_name": { $in: customerNames } } : {}),
                ...(emittedBetween?.start || emittedBetween?.end ? {
                    emitted_date: {
                        ...(emittedBetween.start ? { $gte: emittedBetween.start } : {}),
                        ...(emittedBetween.end ? { $lte: emittedBetween.end } : {}),
                    },
                } : {}),
            },
            rows: r => r({
                select: [] as [],
                pickDistinct: { by: "base_invoice", keep: "last", sortBy: "version" }
            })
        },
    }).run().then(expectSuccess).then((res) => {
        return res?.rows;
    });
    return invoices;
};
const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined);
export const InvoiceProvider = ({ children }: {
    children: ReactNode;
}) => {
    const [invoices, setInvoices] = useState<PopulatedInvoice[]>([]);
    const [invoiceIdsByIssuer, setInvoiceIdsByIssuer] = useState<Record<string, string[]>>({});
    const [filters, setFilters] = useState<Filter>({
        companyNames: undefined,
        customerNames: undefined,
        emittedBetween: undefined,
    });
    const addInvoice = useCallback((newInvoice: PopulatedInvoice) => {
        setInvoices((current) => {
            const next = current.filter((invoice) => invoice.base_invoice?._id !== newInvoice.base_invoice?._id);
            return [newInvoice, ...next];
        });
        setInvoiceIdsByIssuer((current) => {
            const next = Object.fromEntries(Object.entries(current).map(([baseCompanyId, ids]) => [
                baseCompanyId,
                ids.filter((id) => {
                    const existing = invoices.find((invoice) => invoice._id === id);
                    return existing?.base_invoice?._id !== newInvoice.base_invoice?._id;
                }),
            ]));
            const baseCompanyId = getBaseCompanyId(newInvoice.issuer_company);
            if (!baseCompanyId) {
                return next;
            }
            return {
                ...next,
                [baseCompanyId]: [newInvoice._id, ...(next[baseCompanyId] || [])],
            };
        });
    }, [invoices, setInvoices]);
    const fetchInvoices = useCallback(async () => {
        try {
            const groupedInvoiceIds = await getInvoiceIdsByIssuer();
            setInvoiceIdsByIssuer(groupedInvoiceIds);
            return await getFilteredInvoices({
                ...filters,
                invoiceIds: Object.values(groupedInvoiceIds).flat(),
            });
        }
        catch (error) {
            console.error("Failed to fetch invoices:", error);
        }
    }, [filters]);
    useEffect(() => {
        fetchInvoices().then((invoices) => {
            if (invoices)
                setInvoices(invoices);
        });
    }, [fetchInvoices]);
    return (<InvoiceContext.Provider value={{
            invoices,
            invoiceIdsByIssuer,
            setFilters,
            fetchInvoices,
            addInvoice,
        }}>
      {children}
    </InvoiceContext.Provider>);
};
export const useInvoices = () => {
    const context = useContext(InvoiceContext);
    if (!context) {
        throw new Error("useInvoices must be used within an InvoiceProvider");
    }
    return context;
};
