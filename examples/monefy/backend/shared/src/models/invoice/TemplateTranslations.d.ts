import { ILanguage } from "../Languages";
import { RefTo, Serialize } from "@n/adira.core.ts";
export interface IInvoiceTemplateTranslation {
    _id: string;
    language: string & RefTo<ILanguage>;
    opening: string;
    invoice: string;
    table_headers: {
        description: string;
        quantity: string;
        unit_price: string;
        subtotal: string;
        total: string;
    };
    affects: string;
    reported_period: string;
    bank_name: string;
    account_beneficiary: string;
    account_number: string;
    bank_code: string;
    thanks: string;
}
