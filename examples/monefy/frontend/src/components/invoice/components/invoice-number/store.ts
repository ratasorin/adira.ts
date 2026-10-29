import { create } from "zustand";
import type { DraftInvoiceAllocationScope, InvoiceNumberAvailabilityStatus, } from "../../invoice.types";
type InvoiceNumberState = {
    assignedInvoiceNumber: number;
    draftInvoiceAllocationScope: DraftInvoiceAllocationScope;
    draftInvoiceSeqNum: number | null | undefined;
    draftPickerOpen: boolean;
    draftAvailabilityStatus: InvoiceNumberAvailabilityStatus;
    loadingDraftInvoiceSeqNum: boolean;
    saveAsInvoiceAllocationScope: DraftInvoiceAllocationScope;
    saveAsInvoiceNumber: number;
    saveAsModalOpen: boolean;
    saveAsAvailabilityStatus: InvoiceNumberAvailabilityStatus;
    setAssignedInvoiceNumber: (invoiceNumber: number) => void;
    setDraftInvoiceAllocationScope: (scope: DraftInvoiceAllocationScope) => void;
    setDraftInvoiceSeqNum: (seqNum: number | null | undefined) => void;
    setDraftPickerOpen: (open: boolean) => void;
    setDraftAvailabilityStatus: (status: InvoiceNumberAvailabilityStatus) => void;
    setLoadingDraftInvoiceSeqNum: (loading: boolean) => void;
    setSaveAsInvoiceAllocationScope: (scope: DraftInvoiceAllocationScope) => void;
    setSaveAsInvoiceNumber: (invoiceNumber: number) => void;
    setSaveAsModalOpen: (open: boolean) => void;
    setSaveAsAvailabilityStatus: (status: InvoiceNumberAvailabilityStatus) => void;
    resetDraftInvoiceNumber: () => void;
    resetSaveAsInvoiceNumber: () => void;
};
export const useInvoiceNumberStore = create<InvoiceNumberState>()((set) => ({
    assignedInvoiceNumber: 0,
    draftInvoiceAllocationScope: "global",
    draftInvoiceSeqNum: undefined,
    draftPickerOpen: false,
    draftAvailabilityStatus: "idle",
    loadingDraftInvoiceSeqNum: false,
    saveAsInvoiceAllocationScope: "local",
    saveAsInvoiceNumber: 0,
    saveAsModalOpen: false,
    saveAsAvailabilityStatus: "idle",
    setAssignedInvoiceNumber: (assignedInvoiceNumber) => set({ assignedInvoiceNumber }),
    setDraftInvoiceAllocationScope: (draftInvoiceAllocationScope) => set({ draftInvoiceAllocationScope }),
    setDraftInvoiceSeqNum: (draftInvoiceSeqNum) => set({ draftInvoiceSeqNum }),
    setDraftPickerOpen: (draftPickerOpen) => set({ draftPickerOpen }),
    setDraftAvailabilityStatus: (draftAvailabilityStatus) => set({ draftAvailabilityStatus }),
    setLoadingDraftInvoiceSeqNum: (loadingDraftInvoiceSeqNum) => set({ loadingDraftInvoiceSeqNum }),
    setSaveAsInvoiceAllocationScope: (saveAsInvoiceAllocationScope) => set({ saveAsInvoiceAllocationScope }),
    setSaveAsInvoiceNumber: (saveAsInvoiceNumber) => set({ saveAsInvoiceNumber }),
    setSaveAsModalOpen: (saveAsModalOpen) => set({ saveAsModalOpen }),
    setSaveAsAvailabilityStatus: (saveAsAvailabilityStatus) => set({ saveAsAvailabilityStatus }),
    resetDraftInvoiceNumber: () => set({
        assignedInvoiceNumber: 0,
        draftInvoiceAllocationScope: "global",
        draftInvoiceSeqNum: undefined,
        draftAvailabilityStatus: "idle",
    }),
    resetSaveAsInvoiceNumber: () => set({
        saveAsInvoiceNumber: 0,
        saveAsAvailabilityStatus: "idle",
        saveAsInvoiceAllocationScope: "local",
    }),
}));
