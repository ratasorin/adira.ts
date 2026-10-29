import { type Json } from "../../types/json";
import { ErrorResponse } from "../../types";
import { Backend } from "@n/adira.core.ts";
export declare const getViewers: Backend.ExecuteGET<import("../../models/Viewer").IViewer, {}>;
export declare const postViewer: Backend.ExecutePOST<import("../../models/Viewer").IViewer>;
export declare const patchViewer: Backend.ExecutePATCH<import("../../models/Viewer").IViewer>;
export type GetViewersExecutor = typeof getViewers;
export type PostViewerExecutor = typeof postViewer;
export type PatchViewerExecutor = typeof patchViewer;
