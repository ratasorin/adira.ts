import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { ProductLine } from "../components/products/select-products";
import { nanoid } from "nanoid";
export type Actions = {
    init: (rows: ProductLine[]) => void;
    insert: (newRow: Omit<ProductLine, "_id" | "index">) => void;
    update: (id: string, change: Partial<ProductLine>) => void;
    remove: (id: string) => void;
    reorder: (activeId: string, overId: string) => void;
};
export const useProductsLines = create<{
    rows: ProductLine[];
} & Actions>()((set) => ({
    rows: [],
    init: (rows: ProductLine[]) => set({ rows }),
    insert: (newRow) => set((s) => ({
        rows: [...s.rows, { ...newRow, _id: nanoid(), index: s.rows.length }],
    })),
    update: (id: string, change) => set(({ rows }) => ({
        rows: rows.map((r) => (r._id === id ? { ...r, ...change } : r)),
    })),
    reorder: (activeId, overId) => set((state) => {
        const oldIndex = state.rows.findIndex((r) => r._id === activeId);
        const newIndex = state.rows.findIndex((r) => r._id === overId);
        if (oldIndex === newIndex)
            return state;
        const minAffectedIndex = Math.min(oldIndex, newIndex);
        // 1. Move the item in the array
        const newRows = arrayMove(state.rows, oldIndex, newIndex).map((row, idx) => {
            if (idx < minAffectedIndex)
                return row; // Above the "cut", no change.
            return {
                ...row,
                index: idx,
            };
        });
        return { ...state, rows: newRows };
    }),
    remove: (id) => set((s) => ({ rows: s.rows.filter((r) => r._id !== id) })),
}));
