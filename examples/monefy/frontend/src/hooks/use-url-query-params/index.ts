import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { subscribeToPopstate } from "./popstate-registry";
import { PARAM_HISTORY_COUNT, REMOVE_ALL_URL_FILTERS, SEARCH_PARAMS_UPDATE_EVENT, } from "./constant";
import { ClearAllManager } from "./remove-all-filters";
export type UseUrlQueryParamsMode = "LISTEN" | "DISPATCH" | "BOTH";
export type UrlQueryKey = string | undefined;
export type UrlQueryValue = Record<string, UrlQueryKey>;
type UseUrlQueryParamsProps<M extends UseUrlQueryParamsMode, T = UrlQueryKey | UrlQueryKey[]> = {
    queryParamKey: T;
    fallback?: UrlQueryKey;
    mode?: M;
    replaceOtherParams?: boolean;
};
export type OnUrlQueryParamChange = (value: UrlQueryKey, replace?: boolean) => void;
type SingleReturnType<M extends UseUrlQueryParamsMode> = M extends "LISTEN" ? UrlQueryValue : M extends "DISPATCH" ? OnUrlQueryParamChange : [
    UrlQueryValue,
    OnUrlQueryParamChange
];
type MultipleReturnType<M extends UseUrlQueryParamsMode> = M extends "LISTEN" ? UrlQueryValue : M extends "DISPATCH" ? OnUrlQueryParamChange[] : [
    UrlQueryValue,
    OnUrlQueryParamChange[]
];
type UseUrlQueryParamsReturn<M extends UseUrlQueryParamsMode, T extends UrlQueryKey | UrlQueryKey[]> = T extends UrlQueryKey[] ? MultipleReturnType<M> : T extends UrlQueryKey ? SingleReturnType<M> : undefined;
export const clearAllQueryParams = () => {
    document.dispatchEvent(new Event(REMOVE_ALL_URL_FILTERS));
};
const isStringArray = <T extends UrlQueryKey | UrlQueryKey[]>(param: T): param is Extract<T, UrlQueryKey[]> => {
    return Array.isArray(param);
};
const isString = <T>(param: T): param is Extract<T, string> => {
    return typeof param === "string";
};
export const useUrlQueryParams = <M extends UseUrlQueryParamsMode, T extends UrlQueryKey | UrlQueryKey[]>({ queryParamKey, fallback = undefined, mode = "BOTH" as M, }: UseUrlQueryParamsProps<M, T>): UseUrlQueryParamsReturn<M, T> => {
    const [queryParamValue, setQueryParamValue] = useState<UrlQueryValue>(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (isStringArray(queryParamKey)) {
            const values = queryParamKey.reduce((acc, paramKey) => {
                if (paramKey) {
                    const value = searchParams.get(paramKey);
                    if (value)
                        return { ...acc, [paramKey]: value };
                }
                else {
                    return acc;
                }
                return acc;
            }, {} as UrlQueryValue);
            return values;
            // return queryParamKey.map((paramKey) =>
            //   paramKey ? searchParams.get(paramKey) : fallback
            // ) as UrlQueryKey[];
        }
        else if (isString(queryParamKey))
            return {
                [queryParamKey]: searchParams.get(queryParamKey) || fallback,
            } as UrlQueryValue;
        return {};
    });
    useEffect(() => {
        // Reset count on full page reload
        if (!window.history.state?.[PARAM_HISTORY_COUNT]) {
            window.history.replaceState({ ...(window.history.state || {}), [PARAM_HISTORY_COUNT]: 0 }, "", window.location.href);
        }
    }, []);
    const queryParamKeyRef = useRef(queryParamKey);
    const updateValueFromUrl = useCallback(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (isStringArray(queryParamKeyRef.current)) {
            queryParamKeyRef.current.forEach((k) => {
                if (k) {
                    const value = searchParams.get(k);
                    if (value)
                        queryParamValue[k] = value;
                    else
                        delete queryParamValue[k];
                }
                else {
                    return queryParamValue;
                }
            });
            setQueryParamValue({ ...(queryParamValue || {}) });
        }
        else if (isString(queryParamKeyRef.current)) {
            const newValue = searchParams.get(queryParamKeyRef.current);
            setQueryParamValue((prev) => {
                if (newValue === null) {
                    const newState = { ...prev };
                    delete newState[queryParamKeyRef.current as string];
                    return newState;
                }
                else
                    return {
                        ...prev,
                        [queryParamKeyRef.current as string]: newValue,
                    };
            });
        }
    }, []);
    useEffect(() => {
        const unsubscribe = subscribeToPopstate(() => {
            updateValueFromUrl();
        });
        return () => {
            unsubscribe();
        };
    }, [updateValueFromUrl]);
    // Listen to custom param update events
    const handleCustomParamUpdate = useCallback((event: Event) => {
        const customEvent = event as CustomEvent<{
            key: string;
            newValue?: string;
        }>;
        if (customEvent.detail.newValue === undefined ||
            customEvent.detail.newValue === null ||
            customEvent.detail.newValue === "") {
            setQueryParamValue((prev) => {
                const newState = { ...prev };
                delete newState[customEvent.detail.key];
                return newState;
            });
        }
        else {
            setQueryParamValue((prev) => ({
                ...prev,
                [customEvent.detail.key]: customEvent.detail.newValue,
            }));
        }
    }, []);
    useEffect(() => {
        if (mode === "LISTEN" || mode === "BOTH") {
            document.addEventListener(SEARCH_PARAMS_UPDATE_EVENT, handleCustomParamUpdate);
        }
        return () => {
            document.removeEventListener(SEARCH_PARAMS_UPDATE_EVENT, handleCustomParamUpdate);
        };
    }, [handleCustomParamUpdate, mode]);
    const handleClearAll = useCallback(() => {
        setQueryParamValue({});
    }, []);
    useEffect(() => {
        const manager = ClearAllManager.getInstance();
        manager.subscribe(handleClearAll);
        return () => manager.unsubscribe(handleClearAll);
    }, [handleClearAll]);
    const updateQueryParam = useMemo(() => {
        if (isStringArray(queryParamKey)) {
            return queryParamKey.map((paramKey) => {
                return (newValue: string | undefined, replace = false) => {
                    const url = new URL(window.location.href);
                    const searchParams = url.searchParams;
                    if (paramKey)
                        if (newValue === undefined ||
                            newValue === null ||
                            newValue === "") {
                            searchParams.delete(paramKey);
                        }
                        else {
                            searchParams.set(paramKey, newValue);
                        }
                    url.search = searchParams.toString();
                    let currentCount = window.history.state[PARAM_HISTORY_COUNT] || 0;
                    if (currentCount >= 0)
                        currentCount = currentCount + 1;
                    else
                        currentCount = 0;
                    const nextState = {
                        ...window.history.state,
                        [PARAM_HISTORY_COUNT]: currentCount,
                    };
                    if (replace) {
                        window.history.replaceState(nextState, "", url);
                    }
                    else {
                        window.history.pushState(nextState, "", url);
                    }
                    document.dispatchEvent(new CustomEvent(SEARCH_PARAMS_UPDATE_EVENT, {
                        bubbles: true,
                        detail: { key: queryParamKey, newValue },
                    }));
                };
            });
        }
        else if (isString(queryParamKey)) {
            return (newValue: string | undefined, replace = false) => {
                setQueryParamValue({ [queryParamKey]: newValue });
                const url = new URL(window.location.href);
                const searchParams = url.searchParams;
                if (newValue === undefined || newValue === null || newValue === "") {
                    searchParams.delete(queryParamKey);
                }
                else {
                    searchParams.set(queryParamKey, newValue);
                }
                url.search = searchParams.toString();
                let currentCount = window.history.state[PARAM_HISTORY_COUNT] || 0;
                if (currentCount >= 0)
                    currentCount = currentCount + 1;
                else
                    currentCount = 0;
                const nextState = {
                    ...window.history.state,
                    [PARAM_HISTORY_COUNT]: currentCount,
                };
                if (replace) {
                    window.history.replaceState(nextState, "", url);
                }
                else {
                    window.history.pushState(nextState, "", url);
                }
                document.dispatchEvent(new CustomEvent(SEARCH_PARAMS_UPDATE_EVENT, {
                    bubbles: true,
                    detail: { key: queryParamKey, newValue },
                }));
            };
        }
    }, [queryParamKey]);
    if (mode === "LISTEN") {
        return queryParamValue as UseUrlQueryParamsReturn<M, T>;
    }
    if (mode === "DISPATCH") {
        return updateQueryParam as UseUrlQueryParamsReturn<M, T>;
    }
    return [queryParamValue, updateQueryParam] as UseUrlQueryParamsReturn<M, T>;
};
