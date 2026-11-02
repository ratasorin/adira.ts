import { addToast } from "@heroui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { displayError } from "../../../../utils/handle-error";
import { createInvoiceLanguageTemplate, fetchCompanyClosingRemarks, fetchInvoiceLanguageOptions, saveCompanyClosingRemarks, translateInvoiceNotes, type ClosingRemarkEntry, type InvoiceTemplateDraft, } from "./invoice-language.api";
import type { InvoiceLanguageNoticeProps, InvoiceLanguagePanelProps, } from "./invoice-language-panel";
type UseInvoiceLanguageControllerArgs = {
    invoiceId?: string;
    baseInvoiceId: string;
    baseCompanyId?: string;
    hasCompany: boolean;
    settingsOpen: boolean;
    notes: string;
    setNotes: (value: string) => void;
    languageId: string;
    setLanguageId: (value: string) => void;
    currentLanguageId: string;
    currentLanguageCode: string;
};
type UseInvoiceLanguageControllerResult = {
    selectedLanguageCode: string;
    selectedLanguageName: string;
    handleNotesCommit: (value: string) => void;
    panelProps: InvoiceLanguagePanelProps;
    notesMeta: InvoiceLanguageNoticeProps;
};
const createEmptyTemplateDraft = (): InvoiceTemplateDraft => ({
    language_code: "",
    language_name: "",
    opening: "",
    invoice: "",
    table_headers: {
        description: "",
        quantity: "",
        unit_price: "",
        subtotal: "",
        total: "",
    },
    affects: "",
    reported_period: "",
    bank_name: "",
    account_beneficiary: "",
    account_number: "",
    bank_code: "",
    thanks: "",
});
export const useInvoiceLanguageController = ({ invoiceId, baseInvoiceId, baseCompanyId, hasCompany, settingsOpen, notes, setNotes, languageId, setLanguageId, currentLanguageId, currentLanguageCode, }: UseInvoiceLanguageControllerArgs): UseInvoiceLanguageControllerResult => {
    const [languageOptions, setLanguageOptions] = useState<InvoiceLanguagePanelProps["languageOptions"]>([]);
    const [isTranslatingNotes, setIsTranslatingNotes] = useState(false);
    const [notesTranslationSource, setNotesTranslationSource] = useState("");
    const [notesTranslationSourceLanguageCode, setNotesTranslationSourceLanguageCode] = useState("");
    const [displayedNotesLanguageCode, setDisplayedNotesLanguageCode] = useState("");
    const [baseCompanyClosingRemarks, setBaseCompanyClosingRemarks] = useState<ClosingRemarkEntry[]>([]);
    const [closingRemarkAccordionOpen, setClosingRemarkAccordionOpen] = useState(false);
    const [draftClosingRemark, setDraftClosingRemark] = useState("");
    const [isSavingClosingRemark, setIsSavingClosingRemark] = useState(false);
    const [addLanguageOpen, setAddLanguageOpen] = useState(false);
    const [isCreatingLanguage, setIsCreatingLanguage] = useState(false);
    const [newLanguageDraft, setNewLanguageDraft] = useState<InvoiceTemplateDraft>(createEmptyTemplateDraft());
    const refreshLanguageOptions = useCallback(async () => {
        const next = await fetchInvoiceLanguageOptions();
        setLanguageOptions(next);
        return next;
    }, []);
    const selectedLanguage = useMemo(() => {
        return languageOptions.find((l) => l._id === languageId);
    }, [languageId, languageOptions]);
    const selectedLanguageCode = selectedLanguage?.code || "";
    const selectedLanguageName = selectedLanguage?.name || selectedLanguageCode || "";
    const languageChangeWarning = useMemo(() => {
        if (!invoiceId || !notes.trim())
            return null;
        if (!selectedLanguage)
            return null;
        if (currentLanguageId && selectedLanguage._id !== currentLanguageId) {
            return selectedLanguage.name;
        }
        if (!currentLanguageId &&
            currentLanguageCode &&
            selectedLanguage.code !== currentLanguageCode) {
            return selectedLanguage.name;
        }
        return null;
    }, [
        currentLanguageCode,
        currentLanguageId,
        invoiceId,
        notes,
        selectedLanguage,
    ]);
    const hasSelectedLanguageClosingRemark = useMemo(() => {
        if (!selectedLanguageCode)
            return true;
        return baseCompanyClosingRemarks.some((row) => row.language_code === selectedLanguageCode);
    }, [baseCompanyClosingRemarks, selectedLanguageCode]);
    useEffect(() => {
        refreshLanguageOptions()
            .catch((err) => displayError(err, "[Error] Cannot load invoice language options!"));
    }, [refreshLanguageOptions]);
    useEffect(() => {
        if (invoiceId || baseInvoiceId || languageId || languageOptions.length === 0)
            return;
        setLanguageId(languageOptions[0]._id);
    }, [baseInvoiceId, invoiceId, languageId, languageOptions, setLanguageId]);
    useEffect(() => {
        if (!baseCompanyId) {
            setBaseCompanyClosingRemarks([]);
            return;
        }
        fetchCompanyClosingRemarks(baseCompanyId)
            .then(setBaseCompanyClosingRemarks)
            .catch((err) => displayError(err, "[Error] Cannot load company closing remarks!"));
    }, [baseCompanyId]);
    useEffect(() => {
        if (!settingsOpen) {
            setClosingRemarkAccordionOpen(false);
            setDraftClosingRemark("");
            setAddLanguageOpen(false);
            setNewLanguageDraft(createEmptyTemplateDraft());
        }
    }, [settingsOpen]);
    useEffect(() => {
        setClosingRemarkAccordionOpen(false);
        setDraftClosingRemark("");
    }, [selectedLanguageCode, baseCompanyId]);
    useEffect(() => {
        setNotesTranslationSource(notes);
        setNotesTranslationSourceLanguageCode(currentLanguageCode);
        setDisplayedNotesLanguageCode(currentLanguageCode);
    }, [invoiceId, currentLanguageCode, currentLanguageId]);
    useEffect(() => {
        if (!invoiceId ||
            !selectedLanguageCode ||
            !notesTranslationSource.trim() ||
            !notesTranslationSourceLanguageCode ||
            displayedNotesLanguageCode === selectedLanguageCode) {
            return;
        }
        setIsTranslatingNotes(true);
        translateInvoiceNotes({
            text: notesTranslationSource.trim(),
            sourceLanguageCode: notesTranslationSourceLanguageCode,
            targetLanguageCode: selectedLanguageCode,
        })
            .then((payload) => {
            setNotes(payload.text);
            setDisplayedNotesLanguageCode(selectedLanguageCode);
        })
            .catch((err) => displayError(err, "[Error] Cannot translate invoice notices!"))
            .finally(() => {
            setIsTranslatingNotes(false);
        });
    }, [
        displayedNotesLanguageCode,
        invoiceId,
        notesTranslationSource,
        notesTranslationSourceLanguageCode,
        selectedLanguageCode,
        setNotes,
    ]);
    const saveClosingRemark = useCallback(async () => {
        if (!baseCompanyId || !selectedLanguageCode)
            return;
        const text = draftClosingRemark.trim();
        if (!text)
            return;
        setIsSavingClosingRemark(true);
        try {
            const next = [...baseCompanyClosingRemarks];
            const existingIndex = next.findIndex((row) => row.language_code === selectedLanguageCode);
            if (existingIndex >= 0) {
                next[existingIndex] = {
                    ...next[existingIndex],
                    text,
                };
            }
            else {
                next.push({
                    language_code: selectedLanguageCode,
                    text,
                });
            }
            const updatedClosingRemarks = await saveCompanyClosingRemarks({
                baseCompanyId,
                closingRemarks: next,
            });
            setBaseCompanyClosingRemarks(updatedClosingRemarks);
            setClosingRemarkAccordionOpen(false);
            setDraftClosingRemark("");
            addToast({
                title: "Closing remark saved",
                color: "success",
                timeout: 8000,
                description: selectedLanguageName
                    ? `Saved for ${selectedLanguageName}.`
                    : "Saved.",
            });
        }
        catch (err) {
            displayError(err, "[Error] Cannot save closing remark!");
        }
        finally {
            setIsSavingClosingRemark(false);
        }
    }, [
        baseCompanyClosingRemarks,
        baseCompanyId,
        draftClosingRemark,
        selectedLanguageCode,
        selectedLanguageName,
    ]);
    const handleNotesCommit = useCallback((value: string) => {
        const activeLanguageCode = selectedLanguageCode || currentLanguageCode;
        setNotes(value);
        setNotesTranslationSource(value);
        setNotesTranslationSourceLanguageCode(activeLanguageCode);
        setDisplayedNotesLanguageCode(activeLanguageCode);
    }, [currentLanguageCode, selectedLanguageCode, setNotes]);
    const createLanguageTemplate = useCallback(async () => {
        const languageCode = newLanguageDraft.language_code.trim().toLowerCase();
        const languageName = newLanguageDraft.language_name.trim();
        if (!languageCode || !languageName) {
            addToast({
                color: "warning",
                title: "Language code and name are required",
            });
            return;
        }
        const requiredValues = [
            newLanguageDraft.opening,
            newLanguageDraft.invoice,
            newLanguageDraft.table_headers.description,
            newLanguageDraft.table_headers.quantity,
            newLanguageDraft.table_headers.unit_price,
            newLanguageDraft.table_headers.subtotal,
            newLanguageDraft.table_headers.total,
            newLanguageDraft.affects,
            newLanguageDraft.reported_period,
            newLanguageDraft.bank_name,
            newLanguageDraft.account_beneficiary,
            newLanguageDraft.account_number,
            newLanguageDraft.bank_code,
            newLanguageDraft.thanks,
        ];
        if (requiredValues.some((value) => !value.trim())) {
            addToast({
                color: "warning",
                title: "Fill in all template translation fields",
            });
            return;
        }
        setIsCreatingLanguage(true);
        try {
            await createInvoiceLanguageTemplate({
                ...newLanguageDraft,
                language_code: languageCode,
                language_name: languageName,
            });
            const nextOptions = await refreshLanguageOptions();
            const createdLanguage = nextOptions.find((option) => option.code === languageCode);
            if (createdLanguage?._id) {
                setLanguageId(createdLanguage._id);
            }
            setAddLanguageOpen(false);
            setNewLanguageDraft(createEmptyTemplateDraft());
            addToast({
                color: "success",
                title: "Language added",
                description: languageName,
            });
        }
        catch (err) {
            displayError(err, "[Error] Cannot create language template!");
        }
        finally {
            setIsCreatingLanguage(false);
        }
    }, [newLanguageDraft, refreshLanguageOptions, setLanguageId]);
    return {
        selectedLanguageCode,
        selectedLanguageName,
        handleNotesCommit,
        panelProps: {
            languageId,
            languageOptions,
            selectedLanguageCode,
            selectedLanguageName,
            hasCompany,
            hasSelectedLanguageClosingRemark,
            closingRemarkAccordionOpen,
            draftClosingRemark,
            isSavingClosingRemark,
            addLanguageOpen,
            isCreatingLanguage,
            newLanguageDraft,
            onLanguageChange: setLanguageId,
            onToggleClosingRemarkAccordion: () => setClosingRemarkAccordionOpen((value) => !value),
            onDraftClosingRemarkChange: setDraftClosingRemark,
            onSaveClosingRemark: saveClosingRemark,
            onCancelClosingRemark: () => {
                setClosingRemarkAccordionOpen(false);
                setDraftClosingRemark("");
            },
            onToggleAddLanguage: () => setAddLanguageOpen((value) => !value),
            onLanguageDraftChange: (field, value) => setNewLanguageDraft((current) => ({
                ...current,
                [field]: value,
            })),
            onTableHeaderDraftChange: (field, value) => setNewLanguageDraft((current) => ({
                ...current,
                table_headers: {
                    ...current.table_headers,
                    [field]: value,
                },
            })),
            onCreateLanguage: createLanguageTemplate,
            onCancelAddLanguage: () => {
                setAddLanguageOpen(false);
                setNewLanguageDraft(createEmptyTemplateDraft());
            },
        },
        notesMeta: {
            isTranslatingNotes,
            languageChangeWarning,
        },
    };
};
