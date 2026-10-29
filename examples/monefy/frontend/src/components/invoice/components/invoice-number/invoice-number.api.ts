import { expectSuccess } from "../../../../services/api";
import { api } from "../../../../services/api";
export const fetchDraftInvoiceSeqNum = async (baseCompanyId: string) => {
    const { run } = api("/draft/invoices/seqnum/:base_company_id", "GET")({query: {}, 
        path: { base_company_id: baseCompanyId },
    });
    return run().then(expectSuccess).then((res) => res.seqNum as number | undefined);
};
export const checkInvoiceNumberAvailability = async (index: number) => {
    const { run } = api("/invoices/availability/number", "GET")({
        query: {
            index,
        },
    });
    return run().then(expectSuccess).then((res) => Boolean(res.available));
};
