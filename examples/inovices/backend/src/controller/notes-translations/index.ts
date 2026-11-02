import { type Json, json } from "../../types/json";
import { Request, Response } from "express";
import { Backend } from "@n/adira.core.ts";
import { createHash } from "crypto";
import { ErrorResponse } from "../../types";
import { ApiError } from "../../utils/api-errors";
type TranslationResponse = {
    hash: string;
    language_code: string;
    text: string;
    cached: boolean;
};
const translateWithMyMemory = async (text: string, sourceLanguageCode: string, targetLanguageCode: string) => {
    const searchParams = new URLSearchParams({
        q: text,
        langpair: `${sourceLanguageCode}|${targetLanguageCode}`,
    });
    const response = await fetch(`https://api.mymemory.translated.net/get?${searchParams.toString()}`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
        throw new Error(`Translation request failed with ${response.status}`);
    }
    const payload = (await response.json()) as {
        responseData?: {
            translatedText?: string;
        };
    };
    const translatedText = payload.responseData?.translatedText?.trim();
    if (!translatedText) {
        throw new Error("Translation request returned an empty payload");
    }
    return translatedText;
};
export const handleTranslateNotes = async (req: Request<never, never, Json<{
    text: string;
    source_language_code: string;
    target_language_code: string;
}>, {}>, res: Response<Json<TranslationResponse | ErrorResponse>>) => {
    try {
        const text = req.body.text?.trim();
        const sourceLanguageCode = req.body.source_language_code?.trim();
        const targetLanguageCode = req.body.target_language_code?.trim();
        if (!text || !sourceLanguageCode || !targetLanguageCode) {
            throw new ApiError(400, "Missing text or language codes");
        }
        const hash = createHash("sha256").update(text).digest("hex");
        if (sourceLanguageCode === targetLanguageCode) {
            res.status(200).json(json({
                hash,
                language_code: targetLanguageCode,
                text,
                cached: true,
            }));
            return;
        }
        const translatedText = await translateWithMyMemory(text, sourceLanguageCode, targetLanguageCode);
        res.status(200).json(json({
            hash,
            language_code: targetLanguageCode,
            text: translatedText,
            cached: false,
        }));
    }
    catch (error) {
        throw error;
    }
};
