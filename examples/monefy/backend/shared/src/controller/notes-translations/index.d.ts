import { type Json } from "../../types/json";
import { ErrorResponse } from "../../types";
type TranslationResponse = {
    hash: string;
    language_code: string;
    text: string;
    cached: boolean;
};
