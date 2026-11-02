import { RefTo, Serialize } from "@n/adira.core.ts";
export interface IClosingRemark {
    language_code: string;
    text: string;
}
export interface CompanyDetails {
    address: {
        country: string;
        street: string;
        zip: string;
        city: string;
    };
    vat_id: string;
    contact: {
        email: string;
        phone: string;
        fax: string;
        website: string;
    };
    iban: string;
    bic: string;
    bank_name: string;
    tax_number: string;
    account_number: string;
    bank_code: string;
    assets: {
        logo: string;
        signature: string;
        stamp: string;
    };
}
export interface IBaseCompany {
    _id: string;
    closing_remark: IClosingRemark[];
}
export interface ICompany {
    _id: string;
    base_company: string & RefTo<IBaseCompany>;
    details: CompanyDetails;
    primary: boolean;
    hidden: boolean;
    deletedAt?: Date | null;
    createdAt: Date;
    tags?: string[];
    name: string;
}
