import { createApiClient } from "@n/adira.client.ts";
import type { MonefyAPI } from "@monefy/types";
import axios, { AxiosError } from "axios";
import type { ErrorResponse } from "@monefy/types/src/types/index";
axios.defaults.withCredentials = true;
axios.defaults.paramsSerializer = { serialize: params => {
        if (Object.keys(params).length === 1 && typeof params.query === "string")
            return new URLSearchParams({ query: params.query }).toString();
        return new URLSearchParams({ query: JSON.stringify(params) }).toString();
    } };
axios.interceptors.response.use(response => {
    expectSuccess(response.data);
    return response;
});
export function expectSuccess<T>(value: T): Exclude<T, ErrorResponse> {
    if (value && typeof value === "object" && "error" in value && value.error === true) {
        throw new AxiosError("message" in value ? String(value.message) : "Request failed");
    }
    return value as Exclude<T, ErrorResponse>;
}
export const api = createApiClient<MonefyAPI>("");
