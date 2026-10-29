import { useCallback, useEffect, useMemo } from "react";
import { displayError } from "../../../../utils/handle-error";
import { checkInvoiceNumberAvailability, fetchDraftInvoiceSeqNum, } from "./invoice-number.api";
import { useInvoice } from "../../invoice-provider";
import { useInvoiceNumberStore } from "./store";
type InvoiceNumberControllerParams = {
    baseCompanyId?: string;
    companyId?: string;
    invoiceId?: string;
    invoiceNumber: number;
    settingsOpen: boolean;
    isBaseSaveDisabled: boolean;
    hasInvoiceModifications: boolean;
};
const selectAssignedInvoiceNumber = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.assignedInvoiceNumber;
const selectDraftInvoiceAllocationScope = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.draftInvoiceAllocationScope;
const selectDraftInvoiceSeqNum = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.draftInvoiceSeqNum;
const selectDraftAvailabilityStatus = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.draftAvailabilityStatus;
const selectLoadingDraftInvoiceSeqNum = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.loadingDraftInvoiceSeqNum;
const selectSaveAsInvoiceNumber = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.saveAsInvoiceNumber;
const selectSaveAsAvailabilityStatus = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.saveAsAvailabilityStatus;
const selectSaveAsInvoiceAllocationScope = (state: ReturnType<typeof useInvoiceNumberStore.getState>) => state.saveAsInvoiceAllocationScope;
const getDraftInvoiceNumberState = ({ assignedInvoiceNumber, baseCompanyId, draftInvoiceSeqNum, invoiceId, }: {
    assignedInvoiceNumber: number;
    baseCompanyId?: string;
    draftInvoiceSeqNum: number | null | undefined;
    invoiceId?: string;
}) => {
    const isDraftInvoice = !invoiceId;
    const draftInvoiceOriginalNumber = draftInvoiceSeqNum ?? 0;
    const currentDraftInvoiceCounter = draftInvoiceSeqNum != null ? draftInvoiceSeqNum - 1 : null;
    const isDraftInvoiceNumberUnchanged = isDraftInvoice &&
        draftInvoiceOriginalNumber > 0 &&
        assignedInvoiceNumber === draftInvoiceOriginalNumber;
    const canUseGlobalInvoiceNumber = isDraftInvoice &&
        !!baseCompanyId &&
        currentDraftInvoiceCounter != null &&
        assignedInvoiceNumber > currentDraftInvoiceCounter;
    const canCheckDraftInvoiceNumber = isDraftInvoice &&
        !!baseCompanyId &&
        assignedInvoiceNumber > 0 &&
        !isDraftInvoiceNumberUnchanged;
    return {
        canCheckDraftInvoiceNumber,
        canUseGlobalInvoiceNumber,
        currentDraftInvoiceCounter,
        draftInvoiceOriginalNumber,
        isDraftInvoice,
        isDraftInvoiceNumberUnchanged,
    };
};
export function useInvoiceNumberController({ baseCompanyId, companyId, invoiceId, invoiceNumber, settingsOpen, isBaseSaveDisabled, hasInvoiceModifications, }: InvoiceNumberControllerParams) {
    const assignedInvoiceNumber = useInvoiceNumberStore(selectAssignedInvoiceNumber);
    const draftInvoiceAllocationScope = useInvoiceNumberStore(selectDraftInvoiceAllocationScope);
    const draftInvoiceSeqNum = useInvoiceNumberStore(selectDraftInvoiceSeqNum);
    const draftAvailabilityStatus = useInvoiceNumberStore(selectDraftAvailabilityStatus);
    const loadingDraftInvoiceSeqNum = useInvoiceNumberStore(selectLoadingDraftInvoiceSeqNum);
    const saveAsInvoiceNumber = useInvoiceNumberStore(selectSaveAsInvoiceNumber);
    const saveAsAvailabilityStatus = useInvoiceNumberStore(selectSaveAsAvailabilityStatus);
    const saveAsInvoiceAllocationScope = useInvoiceNumberStore(selectSaveAsInvoiceAllocationScope);
    const setAssignedInvoiceNumber = useInvoiceNumberStore((state) => state.setAssignedInvoiceNumber);
    const setDraftInvoiceSeqNum = useInvoiceNumberStore((state) => state.setDraftInvoiceSeqNum);
    const setLoadingDraftInvoiceSeqNum = useInvoiceNumberStore((state) => state.setLoadingDraftInvoiceSeqNum);
    const setDraftInvoiceAllocationScope = useInvoiceNumberStore((state) => state.setDraftInvoiceAllocationScope);
    const setDraftAvailabilityStatus = useInvoiceNumberStore((state) => state.setDraftAvailabilityStatus);
    const setDraftPickerOpen = useInvoiceNumberStore((state) => state.setDraftPickerOpen);
    const resetDraftInvoiceNumber = useInvoiceNumberStore((state) => state.resetDraftInvoiceNumber);
    const resetSaveAsInvoiceNumber = useInvoiceNumberStore((state) => state.resetSaveAsInvoiceNumber);
    const setSaveAsModalOpen = useInvoiceNumberStore((state) => state.setSaveAsModalOpen);
    const setSaveAsInvoiceAllocationScope = useInvoiceNumberStore((state) => state.setSaveAsInvoiceAllocationScope);
    const { canUseGlobalInvoiceNumber, isDraftInvoice, isDraftInvoiceNumberUnchanged, } = useMemo(() => getDraftInvoiceNumberState({
        assignedInvoiceNumber,
        baseCompanyId,
        draftInvoiceSeqNum,
        invoiceId,
    }), [assignedInvoiceNumber, baseCompanyId, draftInvoiceSeqNum, invoiceId]);
    useEffect(() => {
        window.setTimeout(() => {
            if (!invoiceId && !companyId) {
                resetDraftInvoiceNumber();
                return;
            }
            if (invoiceNumber) {
                setAssignedInvoiceNumber(invoiceNumber);
                setDraftInvoiceSeqNum(undefined);
                setDraftAvailabilityStatus("idle");
            }
            if (!baseCompanyId || invoiceId)
                return;
            fetchDraftInvoiceSeqNum(String(baseCompanyId))
                .then((seqNum) => {
                if (seqNum) {
                    setDraftInvoiceSeqNum(seqNum);
                    setAssignedInvoiceNumber(seqNum);
                    setDraftAvailabilityStatus("idle");
                    setDraftInvoiceAllocationScope("global");
                }
            })
                .catch((err) => displayError(err, "[Error] Cannot find sequence number!"));
        }, 0);
    }, [
        baseCompanyId,
        companyId,
        invoiceId,
        invoiceNumber,
        resetDraftInvoiceNumber,
        setAssignedInvoiceNumber,
        setDraftAvailabilityStatus,
        setDraftInvoiceAllocationScope,
        setDraftInvoiceSeqNum,
    ]);
    useEffect(() => {
        if (draftInvoiceAllocationScope === "global" &&
            isDraftInvoice &&
            assignedInvoiceNumber > 0 &&
            !canUseGlobalInvoiceNumber) {
            setDraftInvoiceAllocationScope("local");
        }
    }, [
        assignedInvoiceNumber,
        canUseGlobalInvoiceNumber,
        draftInvoiceAllocationScope,
        isDraftInvoice,
        setDraftInvoiceAllocationScope,
    ]);
    useEffect(() => {
        if (!settingsOpen) {
            setDraftPickerOpen(false);
        }
    }, [settingsOpen, setDraftPickerOpen]);
    useEffect(() => {
        setDraftInvoiceSeqNum(undefined);
        setDraftAvailabilityStatus("idle");
        setDraftInvoiceAllocationScope("global");
    }, [
        baseCompanyId,
        setDraftAvailabilityStatus,
        setDraftInvoiceAllocationScope,
        setDraftInvoiceSeqNum,
    ]);
    const beginSaveAsDifferentNumber = useCallback(() => {
        resetSaveAsInvoiceNumber();
        setSaveAsModalOpen(true);
    }, [resetSaveAsInvoiceNumber, setSaveAsModalOpen]);
    const completeSaveAsDifferentNumber = useCallback(() => {
        setSaveAsModalOpen(false);
        resetSaveAsInvoiceNumber();
    }, [resetSaveAsInvoiceNumber, setSaveAsModalOpen]);
    const loadPredictedInvoiceNumber = useCallback(async () => {
        if (!baseCompanyId ||
            loadingDraftInvoiceSeqNum ||
            draftInvoiceSeqNum !== undefined) {
            return;
        }
        setLoadingDraftInvoiceSeqNum(true);
        try {
            const seqNum = await fetchDraftInvoiceSeqNum(String(baseCompanyId));
            setDraftInvoiceSeqNum(seqNum ?? null);
        }
        catch (error) {
            setDraftInvoiceSeqNum(null);
            displayError(error, "[Error] Failed to predict invoice number!");
        }
        finally {
            setLoadingDraftInvoiceSeqNum(false);
        }
    }, [
        baseCompanyId,
        draftInvoiceSeqNum,
        loadingDraftInvoiceSeqNum,
        setDraftInvoiceSeqNum,
        setLoadingDraftInvoiceSeqNum,
    ]);
    const isDraftInvoiceNumberSaveBlocked = isDraftInvoice &&
        (!assignedInvoiceNumber ||
            (!isDraftInvoiceNumberUnchanged &&
                draftAvailabilityStatus !== "available"));
    return {
        assignedInvoiceNumber,
        beginSaveAsDifferentNumber,
        canSaveAsDifferentNumber: Boolean(invoiceId) &&
            !isBaseSaveDisabled &&
            !isDraftInvoiceNumberSaveBlocked &&
            hasInvoiceModifications &&
            saveAsAvailabilityStatus === "available",
        draftInvoiceAllocationScope,
        isDraftInvoiceNumberSaveBlocked,
        completeSaveAsDifferentNumber,
        loadingPredictedInvoiceNumber: loadingDraftInvoiceSeqNum,
        loadPredictedInvoiceNumber,
        predictedInvoiceNumber: draftInvoiceSeqNum,
        saveAsInvoiceAllocationScope,
        saveAsInvoiceNumber,
    };
}
export function usePickForNewInvoiceNumber() {
    const { company, invoiceId } = useInvoice();
    const baseCompanyId = company?.base_company
        ? String(company.base_company)
        : undefined;
    const assignedInvoiceNumber = useInvoiceNumberStore(selectAssignedInvoiceNumber);
    const draftInvoiceAllocationScope = useInvoiceNumberStore(selectDraftInvoiceAllocationScope);
    const draftInvoiceSeqNum = useInvoiceNumberStore(selectDraftInvoiceSeqNum);
    const draftPickerOpen = useInvoiceNumberStore((state) => state.draftPickerOpen);
    const availabilityStatus = useInvoiceNumberStore(selectDraftAvailabilityStatus);
    const setAssignedInvoiceNumber = useInvoiceNumberStore((state) => state.setAssignedInvoiceNumber);
    const setDraftInvoiceAllocationScope = useInvoiceNumberStore((state) => state.setDraftInvoiceAllocationScope);
    const setDraftPickerOpen = useInvoiceNumberStore((state) => state.setDraftPickerOpen);
    const setDraftAvailabilityStatus = useInvoiceNumberStore((state) => state.setDraftAvailabilityStatus);
    const draftState = getDraftInvoiceNumberState({
        assignedInvoiceNumber,
        baseCompanyId,
        draftInvoiceSeqNum,
        invoiceId,
    });
    const onAssignedInvoiceNumberChange = useCallback((invoiceNumber: number) => {
        setAssignedInvoiceNumber(invoiceNumber);
        setDraftAvailabilityStatus("idle");
    }, [setAssignedInvoiceNumber, setDraftAvailabilityStatus]);
    const checkInvoiceNumber = useCallback(async () => {
        if (!draftState.canCheckDraftInvoiceNumber)
            return;
        setDraftAvailabilityStatus("checking");
        try {
            const available = await checkInvoiceNumberAvailability(assignedInvoiceNumber);
            setDraftAvailabilityStatus(available ? "available" : "taken");
        }
        catch (error) {
            setDraftAvailabilityStatus("idle");
            displayError(error, "[Error] Failed to verify invoice number!");
        }
    }, [
        assignedInvoiceNumber,
        draftState.canCheckDraftInvoiceNumber,
        setDraftAvailabilityStatus,
    ]);
    return {
        ...draftState,
        allocationScope: draftInvoiceAllocationScope,
        assignedInvoiceNumber,
        availabilityStatus,
        hasCompany: !!company?._id,
        isOpen: draftPickerOpen,
        onAllocationScopeChange: setDraftInvoiceAllocationScope,
        onAssignedInvoiceNumberChange,
        onCheckInvoiceNumber: checkInvoiceNumber,
        onOpenChange: setDraftPickerOpen,
    };
}
export function useBranchConfirmInvoiceNumber() {
    const { company } = useInvoice();
    const baseCompanyId = company?.base_company
        ? String(company.base_company)
        : undefined;
    const invoiceNumber = useInvoiceNumberStore(selectSaveAsInvoiceNumber);
    const isOpen = useInvoiceNumberStore((state) => state.saveAsModalOpen);
    const availabilityStatus = useInvoiceNumberStore(selectSaveAsAvailabilityStatus);
    const setInvoiceNumber = useInvoiceNumberStore((state) => state.setSaveAsInvoiceNumber);
    const setOpen = useInvoiceNumberStore((state) => state.setSaveAsModalOpen);
    const setAvailabilityStatus = useInvoiceNumberStore((state) => state.setSaveAsAvailabilityStatus);
    const saveAsInvoiceAllocationScope = useInvoiceNumberStore(selectSaveAsInvoiceAllocationScope);
    const setSaveAsInvoiceAllocationScope = useInvoiceNumberStore((state) => state.setSaveAsInvoiceAllocationScope);
    const resetSaveAsInvoiceNumber = useInvoiceNumberStore((state) => state.resetSaveAsInvoiceNumber);
    const canCheckInvoiceNumber = !!baseCompanyId && invoiceNumber > 0 && availabilityStatus !== "checking";
    const onOpenChange = useCallback((open: boolean) => {
        setOpen(open);
        if (!open) {
            resetSaveAsInvoiceNumber();
        }
    }, [resetSaveAsInvoiceNumber, setOpen]);
    const onInvoiceNumberChange = useCallback((nextInvoiceNumber: number) => {
        setInvoiceNumber(nextInvoiceNumber);
        setAvailabilityStatus("idle");
    }, [setAvailabilityStatus, setInvoiceNumber]);
    const checkInvoiceNumber = useCallback(async () => {
        if (!canCheckInvoiceNumber)
            return;
        setAvailabilityStatus("checking");
        try {
            const available = await checkInvoiceNumberAvailability(invoiceNumber);
            setAvailabilityStatus(available ? "available" : "taken");
        }
        catch (error) {
            setAvailabilityStatus("idle");
            displayError(error, "[Error] Failed to verify invoice number!");
        }
    }, [canCheckInvoiceNumber, invoiceNumber, setAvailabilityStatus]);
    return {
        availabilityStatus,
        canCheckInvoiceNumber,
        invoiceNumber,
        allocationScope: saveAsInvoiceAllocationScope,
        isOpen,
        onCheckInvoiceNumber: checkInvoiceNumber,
        onInvoiceNumberChange,
        onAllocationScopeChange: setSaveAsInvoiceAllocationScope,
        onOpenChange,
    };
}
