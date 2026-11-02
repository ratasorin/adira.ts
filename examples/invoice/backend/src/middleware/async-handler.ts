import { type Json } from "../types/json";
import { NextFunction, Request, RequestHandler, Response } from "express";
type AsyncRouteHandler = (...args: any[]) => unknown;
export const asyncHandler = (handler: AsyncRouteHandler) => ((req: Request<never, never, never, {}>, res: Response<Json<Record<string, unknown>>>, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
}) as RequestHandler;
