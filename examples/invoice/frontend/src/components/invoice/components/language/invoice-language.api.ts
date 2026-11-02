import { expectSuccess } from "../../../../services/api";
import { api } from "../../../../services/api";
export type LanguageOption = {
    _id: string;
    code: string;
    name: string;
};
export type ClosingRemarkEntry = {
    language_code: string;
    text: string;
};
export type InvoiceTemplateDraft = {
    language_code: string;
    language_name: string;
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
};
export type TranslateInvoiceNotesResponse = {
    hash: string;
    language_code: string;
    text: string;
    cached: boolean;
};
const getBaseCompany = api("/base-companies/:id", "GET");
const patchBaseCompany = api("/base-companies/:id", "PATCH");
export const fetchInvoiceLanguageOptions = async () => {
    const { run } = api("/templates", "GET")({
        query: {
            include: ["language"],
            rows: r => r({
                select: ["language"]
            })
        },
    });
    return run().then(expectSuccess).then((res) => {
        const rows = res?.rows || [];
        const unique = new Map<string, LanguageOption>();
        rows.forEach((row) => {
            const language = row.language;
            if (!language?._id)
                return;
            unique.set(String(language._id), {
                _id: String(language._id),
                code: String(language.code || ""),
                name: String(language.name || language.code || ""),
            });
        });
        return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
    });
};
export const fetchCompanyClosingRemarks = async (baseCompanyId: string) => {
    const { run } = getBaseCompany({
        path: { id: baseCompanyId },
        query: {
            where: { _id: { $eq: baseCompanyId } },
            rows: r => r({
                select: ["closing_remark"]
            })
        },
    });
    return run().then(expectSuccess).then((res) => (res?.rows[0]?.closing_remark || []) as ClosingRemarkEntry[]);
};
export const saveCompanyClosingRemarks = async ({ baseCompanyId, closingRemarks, }: {
    baseCompanyId: string;
    closingRemarks: ClosingRemarkEntry[];
}) => {
    const { run } = patchBaseCompany({
        path: { id: baseCompanyId },
        data: {
            closing_remark: closingRemarks,
        },
        query: {
            rows: r => r({
                select: ["closing_remark"]
            })
        },
    });
    return run().then(expectSuccess).then((res) => (res?.closing_remark || []) as ClosingRemarkEntry[]);
};
export const createInvoiceLanguageTemplate = async (payload: InvoiceTemplateDraft) => {
    const response = await fetch(`/api/templates`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    const body = (await response.json()) as {
        error?: boolean;
        message?: string;
        _id?: string;
        language?: string;
    };
    if (!response.ok || body.error) {
        throw new Error(body.message || "Unable to create language template");
    }
    return body;
};
export const translateInvoiceNotes = async ({ text, sourceLanguageCode, targetLanguageCode, }: {
    text: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
}) => {
    const response = await fetch(`/api/notes-translations/translate`, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            text,
            source_language_code: sourceLanguageCode,
            target_language_code: targetLanguageCode,
        }),
    });
    const payload = (await response.json()) as {
        text?: string;
        message?: string;
        hash?: string;
        language_code?: string;
        cached?: boolean;
    };
    if (!response.ok || !payload.text || !payload.language_code) {
        throw new Error(payload.message || "Unable to translate notes");
    }
    return {
        hash: payload.hash || "",
        language_code: payload.language_code,
        text: payload.text,
        cached: Boolean(payload.cached),
    };
};
