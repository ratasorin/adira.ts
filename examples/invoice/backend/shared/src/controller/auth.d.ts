import { type Json } from "../types/json";
import type { ReturnResponse } from "../types";
export interface Account {
    id: string;
    username: string;
    email: string;
    role: "BASIC" | "ADVANCED";
}
