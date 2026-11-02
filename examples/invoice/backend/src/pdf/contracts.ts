import type { ResolvedInvoice } from "../controller/invoice/types";
export type RenderPayload = ResolvedInvoice;
export interface PdfJob {
    id: string;
    owner: string;
    hash: string;
    payload: RenderPayload;
    attempts: number;
}
export interface PdfJobStatus {
    id: string;
    status: "queued" | "processing" | "ready" | "failed";
    cache: "HIT" | "MISS" | "COALESCED";
    createdAt: number;
    completedAt?: number;
    renderMs?: number;
    artifactUrl?: string;
    message?: string;
}
export interface StoredJob extends PdfJobStatus {
    owner: string;
    hash: string;
}
export interface PreviewJobResponse extends PdfJobStatus {
    statusUrl: string;
}
