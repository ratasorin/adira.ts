import { create } from "zustand";
import { fetchCompanies, type Company } from "./companies.api";
export const sortCompaniesByDate = (companies: Company[]) => [...companies].sort((left, right) => new Date(right.createdAt || 0).getTime() -
    new Date(left.createdAt || 0).getTime());
const dedupeCompaniesById = (companies: Company[]) => {
    const seen = new Set<string>();
    return companies.filter((company) => {
        if (seen.has(company._id))
            return false;
        seen.add(company._id);
        return true;
    });
};
type EmitterCompaniesState = {
    companies: Company[];
    isLoading: boolean;
    refreshCompanies: () => Promise<Company[]>;
};
export const useEmitterCompanies = create<EmitterCompaniesState>()((set) => ({
    companies: [],
    isLoading: false,
    refreshCompanies: async () => {
        set({ isLoading: true });
        try {
            const rows = sortCompaniesByDate(dedupeCompaniesById(await fetchCompanies()));
            set({ companies: rows });
            return rows;
        }
        finally {
            set({ isLoading: false });
        }
    },
}));
