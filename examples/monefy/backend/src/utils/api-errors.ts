export class ApiError extends Error {
    constructor(public status: number, message: string, public code = "API_ERROR", public expose = true, public metadata?: Record<string, unknown>) {
        super(message);
        this.name = "ApiError";
    }
}
