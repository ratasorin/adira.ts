export interface ErrorResponse {
    message: string;
    error: true;
    code?: string;
    metadata?: Record<string, unknown>;
}
export interface ReturnResponse {
    message: string;
    metadata?: {
        role: "BASIC" | "ADVANCED";
        username: string;
    };
}
