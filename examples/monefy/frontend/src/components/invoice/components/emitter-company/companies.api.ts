import { expectSuccess } from "../../../../services/api";
import { api } from "../../../../services/api";
export const fetchCompanies = () => {
    const { run } = api("/companies", "GET")({
        query: {
            include: ["base_company"],
            
            rows: r => r({
                select: [] as [],
                sortBy: { "createdAt": -1 }
            })
        },
    });
    return run().then(expectSuccess).then((res) => res?.rows || []);
};
export type Company = NonNullable<Awaited<ReturnType<typeof fetchCompanies>>>[number];
