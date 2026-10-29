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
export interface PreviewJobResponse extends PdfJobStatus {
    statusUrl: string;
}
