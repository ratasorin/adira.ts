export const getBaseCompanyId = (company?: {
    base_company: string;
} | undefined | null | {
    base_company?: {
        _id: string;
    } | null;
}) => typeof company?.base_company === "string"
    ? company.base_company
    : company?.base_company?._id || "";
