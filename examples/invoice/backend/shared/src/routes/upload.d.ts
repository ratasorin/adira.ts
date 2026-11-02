import { type Json } from "../types/json";
import { ErrorResponse } from "../types";
export type UploadRequestBody = {
    file: unknown | unknown | never;
};
export interface UploadResponse {
    id: string;
}
