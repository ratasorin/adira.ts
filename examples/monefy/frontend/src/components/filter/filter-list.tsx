import { useMemo } from "react";
import { Field, FilterProps } from "./types";
import { UrlQueryKey, useUrlQueryParams, } from "../../hooks/use-url-query-params";
type EnhancedField<T, K extends keyof T> = Field<T, K> & {
    compareValue: UrlQueryKey;
};
const urlQueryValueIsNotEmpty = <T, K extends keyof T>(field: EnhancedField<T, K>): field is EnhancedField<T, K> & {
    compareValue: {
        length: number;
    };
} => {
    return (!!field.compareValue &&
        field.compareValue.length > 0 &&
        field.compareValue !== "undefined" &&
        field.compareValue !== "null");
};
export const useFilteredData = <T,>(props: FilterProps<T>) => {
    const params = useUrlQueryParams({
        queryParamKey: props.fields.map((f) => String(f.key)),
        mode: "LISTEN",
    });
    const filters = useMemo(() => {
        return props.fields.map((f) => ({ ...f, compareValue: params[String(f.key)] } as EnhancedField<T, keyof T>));
    }, [props.fields, params]);
    const applyFilter = <T, K extends keyof T>(data: T[], field: EnhancedField<T, K>): T[] => {
        if (field.mode === "RANGE" && urlQueryValueIsNotEmpty(field)) {
            const minMax = field.compareValue.split(";");
            if (!minMax)
                return data;
            const intMin = Number(minMax[0]);
            const intMax = Number(minMax[1]);
            return data.filter((d) => {
                const currentValue = Number(field.value(d[field.key]));
                if (currentValue <= intMax && currentValue >= intMin)
                    return true;
                else
                    return false;
            });
        }
        if ((field.mode === "BINARY" || field.mode === "SEARCH") &&
            urlQueryValueIsNotEmpty(field)) {
            return data.filter((d) => {
                const currentValue = field.value(d[field.key]);
                if (currentValue === field.compareValue)
                    return true;
                else
                    return false;
            });
        }
        if (field.mode === "MULTIPLE" && urlQueryValueIsNotEmpty(field)) {
            const validValues = field.compareValue.split(";") || [];
            return data.filter((d) => {
                const currentValue = field.value(d[field.key]);
                if (validValues.find((v) => Array.isArray(currentValue)
                    ? currentValue.includes(v)
                    : v === currentValue))
                    return true;
                else
                    return false;
            });
        }
        return data;
    };
    const data = useMemo(() => {
        let data = props.data;
        for (const filter of filters) {
            data = applyFilter(data, filter);
        }
        return data;
    }, [props.data, filters]);
    return [data, props] as const;
};
export const FilteredList = <T,>(props: FilterProps<T>) => {
    const [filteredData,] = useFilteredData(props);
    return filteredData.map((d, idx) => {
        // Ensure stable identity for list items so internal state (e.g. popovers)
        // isn't lost on re-renders triggered by URL/search param changes.
        const key = (d as unknown as {
            _id?: string | number;
        })._id ??
            (d as unknown as {
                id?: string | number;
            }).id ??
            idx;
        return <props.RenderUnit key={String(key)} item={d}/>;
    });
};
