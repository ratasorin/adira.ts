import { arrayMove } from "@dnd-kit/sortable";
import { Currency } from "@monefy/types/src/models/Product";
import { nanoid } from "nanoid";
import { create } from "zustand";
export type TranslationState = {
    displayName?: string;
    translationLanguageCode?: string;
    isMissingTranslation?: boolean;
    translationDraft?: string;
    isSavingTranslation?: boolean;
    isEditingTranslation?: boolean;
    isLoadingTranslationDraft?: boolean;
};
export type TranslationDisplayState = {
    displayName: string;
    translationLanguageCode?: string;
    isMissingTranslation: boolean;
};
export type ModifierBlueprint = {
    _id: string;
    name: string;
    scope: "line" | "total";
    type: "percentage" | "fixed";
    operation: "add" | "subtract";
    value: number;
    currency?: Currency;
} & TranslationState;
export type ViewerBlueprint = {
    _id: string;
    name: string;
} & TranslationState;
export type ModifierOperationLine = {
    _id: string;
    kind: "modifier";
    modifier: ModifierBlueprint;
    index: number;
    targetProductLine?: string[];
};
export type ViewerOperationLine = {
    _id: string;
    kind: "viewer";
    viewer: ViewerBlueprint;
    index: number;
    subtotal?: number;
    currency?: Currency;
};
export type OperationLine = ModifierOperationLine | ViewerOperationLine;
type Actions = {
    init: (rows: OperationLine[]) => void;
    insertModifier: (row: Omit<ModifierOperationLine, "_id" | "index" | "kind">) => void;
    insertViewer: (row: Omit<ViewerOperationLine, "_id" | "index" | "kind">) => void;
    remove: (id: string) => void;
    reorder: (activeId: string, overId: string) => void;
    patchModifierBlueprints: (patches: Record<string, Partial<ModifierBlueprint>>) => void;
    patchViewerBlueprints: (patches: Record<string, Partial<ViewerBlueprint>>) => void;
    setModifierDisplayStates: (states: Record<string, TranslationDisplayState>) => void;
    setViewerDisplayStates: (states: Record<string, TranslationDisplayState>) => void;
    patchModifierDisplayState: (modifierId: string, patch: Partial<TranslationDisplayState>) => void;
    patchViewerDisplayState: (viewerId: string, patch: Partial<TranslationDisplayState>) => void;
};
export const useInvoiceOperations = create<{
    rows: OperationLine[];
    modifierDisplayById: Record<string, TranslationDisplayState>;
    viewerDisplayById: Record<string, TranslationDisplayState>;
} & Actions>()((set) => ({
    rows: [],
    modifierDisplayById: {},
    viewerDisplayById: {},
    init: (rows) => set({ rows: [...rows].sort((a, b) => a.index - b.index) }),
    insertModifier: (row) => set((state) => ({
        rows: [
            ...state.rows,
            {
                ...row,
                _id: nanoid(),
                index: state.rows.length,
                kind: "modifier",
            },
        ],
    })),
    insertViewer: (row) => set((state) => ({
        rows: [
            ...state.rows,
            {
                ...row,
                _id: nanoid(),
                index: state.rows.length,
                kind: "viewer",
            },
        ],
    })),
    remove: (id) => set((state) => ({
        rows: state.rows
            .filter((row) => row._id !== id)
            .map((row, index) => ({ ...row, index })),
    })),
    reorder: (activeId, overId) => set((state) => {
        const oldIndex = state.rows.findIndex((row) => row._id === activeId);
        const newIndex = state.rows.findIndex((row) => row._id === overId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
            return state;
        }
        return {
            rows: arrayMove(state.rows, oldIndex, newIndex).map((row, index) => ({
                ...row,
                index,
            })),
        };
    }),
    patchModifierBlueprints: (patches) => set((state) => ({
        rows: state.rows.map((row) => row.kind === "modifier" && patches[row.modifier._id]
            ? {
                ...row,
                modifier: {
                    ...row.modifier,
                    ...patches[row.modifier._id],
                },
            }
            : row),
    })),
    patchViewerBlueprints: (patches) => set((state) => ({
        rows: state.rows.map((row) => row.kind === "viewer" && patches[row.viewer._id]
            ? {
                ...row,
                viewer: {
                    ...row.viewer,
                    ...patches[row.viewer._id],
                },
            }
            : row),
    })),
    setModifierDisplayStates: (states) => set({ modifierDisplayById: states }),
    setViewerDisplayStates: (states) => set({ viewerDisplayById: states }),
    patchModifierDisplayState: (modifierId, patch) => set((state) => ({
        modifierDisplayById: {
            ...state.modifierDisplayById,
            [modifierId]: {
                displayName: patch.displayName ??
                    state.modifierDisplayById[modifierId]?.displayName ??
                    "",
                translationLanguageCode: patch.translationLanguageCode ??
                    state.modifierDisplayById[modifierId]?.translationLanguageCode,
                isMissingTranslation: patch.isMissingTranslation ??
                    state.modifierDisplayById[modifierId]?.isMissingTranslation ??
                    false,
            },
        },
    })),
    patchViewerDisplayState: (viewerId, patch) => set((state) => ({
        viewerDisplayById: {
            ...state.viewerDisplayById,
            [viewerId]: {
                displayName: patch.displayName ??
                    state.viewerDisplayById[viewerId]?.displayName ??
                    "",
                translationLanguageCode: patch.translationLanguageCode ??
                    state.viewerDisplayById[viewerId]?.translationLanguageCode,
                isMissingTranslation: patch.isMissingTranslation ??
                    state.viewerDisplayById[viewerId]?.isMissingTranslation ??
                    false,
            },
        },
    })),
}));
