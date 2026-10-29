import { type Json, json } from "../types/json";
import { assetsDirectory } from "../utils/assets";
import { protectRoute } from "../middleware/auth";
import { Router, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { ErrorResponse } from "../types";
import { Backend } from "@n/adira.core.ts";
import { ApiError } from "../utils/api-errors";
import { asyncHandler } from "../middleware/async-handler";
// Multer storage config (store in memory, we'll move it ourselves)
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed!"));
        }
        cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});
export type UploadRequestBody = {
    file: Blob | File | never;
};
export interface UploadResponse {
    id: string;
}
const uploadRouter = Router();
export const handleFileUpload = async (req: Request<never, never, Json<UploadRequestBody>, {}>, res: Response<Json<UploadResponse | ErrorResponse>>) => {
    try {
        if (!req.file) {
            throw new ApiError(400, "No file uploaded.");
        }
        const uniqueId = uuidv4();
        const ext = path.extname(req.file.originalname) || ".jpg";
        const assetsDir = assetsDirectory;
        const filePath = path.join(assetsDir, uniqueId + ext);
        // Ensure assets directory exists
        try {
            await fs.mkdir(assetsDir, { recursive: true });
        }
        catch (mkdirErr) {
            throw new ApiError(500, "Failed to create assets directory.", "ASSET_DIRECTORY_CREATE_FAILED", true, { cause: mkdirErr });
        }
        // Write file
        try {
            await fs.writeFile(filePath, req.file.buffer);
        }
        catch (writeErr) {
            throw new ApiError(500, "Failed to save file.", "FILE_SAVE_FAILED", true, {
                cause: writeErr,
            });
        }
        res.status(200).json(json({ id: uniqueId + ext }));
        return;
    }
    catch (err) {
        if (err instanceof multer.MulterError) {
            throw new ApiError(400, `Multer error: ${err.message}`);
        }
        throw err;
    }
};
uploadRouter.post("/upload", protectRoute(), upload.single("file"), handleFileUpload);
export default uploadRouter;
