import { type Json, json } from "../../types/json";
import { Request, Response } from "express";
import ModifierViewerTranslation, { IModifierViewerTranslation, ModifierViewerEntityType, } from "../../models/ModifierViewerTranslation";
import { ErrorResponse } from "../../types";
import { ApiError } from "../../utils/api-errors";
type GetTranslationsQuery = {
    entity_type?: string;
    entity_ids?: string | string[];
    "entity_ids[]"?: string | string[];
    language_code?: string;
};
type UpsertTranslationBody = {
    entity_type?: string;
    entity_id?: string;
    language_code?: string;
    text?: string;
};
const isEntityType = (value: string): value is ModifierViewerEntityType => value === "modifier" || value === "viewer";
const toStringArray = (value: string | string[] | undefined) => {
    if (!value)
        return [];
    return Array.isArray(value) ? value : [value];
};
export const handleGetModifierViewerTranslations = async (req: Request<never, never, never, GetTranslationsQuery>, res: Response<Json<ErrorResponse | {
    rows: IModifierViewerTranslation[];
}>>) => {
    try {
        const entityType = String(req.query.entity_type || "").trim();
        const languageCode = String(req.query.language_code || "")
            .trim()
            .toLowerCase();
        const entityIds = [
            ...toStringArray(req.query.entity_ids),
            ...toStringArray(req.query["entity_ids[]"]),
        ]
            .map((value) => value.trim())
            .filter(Boolean);
        if (!isEntityType(entityType)) {
            throw new ApiError(400, "Invalid or missing entity_type");
        }
        if (!languageCode) {
            throw new ApiError(400, "Missing language_code");
        }
        if (entityIds.length === 0) {
            res.status(200).json(json({ rows: [] }));
            return;
        }
        const rows = await ModifierViewerTranslation.find({
            entity_type: entityType,
            entity_id: { $in: entityIds },
            language_code: languageCode,
        }).lean();
        res.status(200).json(json({
            rows: rows.map((row) => ({
                _id: String(row._id),
                entity_type: row.entity_type,
                entity_id: String(row.entity_id),
                language_code: row.language_code,
                text: row.text,
            })),
        }));
    }
    catch (error) {
        throw error;
    }
};
export const handleUpsertModifierViewerTranslation = async (req: Request<never, never, Json<UpsertTranslationBody>, {}>, res: Response<Json<ErrorResponse | IModifierViewerTranslation>>) => {
    try {
        const entityType = String(req.body.entity_type || "").trim();
        const entityId = String(req.body.entity_id || "").trim();
        const languageCode = String(req.body.language_code || "")
            .trim()
            .toLowerCase();
        const text = String(req.body.text || "").trim();
        if (!isEntityType(entityType) || !entityId || !languageCode || !text) {
            throw new ApiError(400, "Missing entity_type, entity_id, language_code or text");
        }
        const row = await ModifierViewerTranslation.findOneAndUpdate({
            entity_type: entityType,
            entity_id: entityId,
            language_code: languageCode,
        }, {
            $set: {
                entity_type: entityType,
                entity_id: entityId,
                language_code: languageCode,
                text,
            },
        }, {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
        }).lean();
        if (!row) {
            throw new ApiError(500, "Unable to save translation");
        }
        res.status(200).json(json({
            _id: String(row._id),
            entity_type: row.entity_type,
            entity_id: String(row.entity_id),
            language_code: row.language_code,
            text: row.text,
        }));
    }
    catch (error) {
        throw error;
    }
};
