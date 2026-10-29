import { type Json } from "../../types/json";
import { ErrorResponse } from "../../types";
import { Backend } from "@n/adira.core.ts";
export declare const getModifiers: Backend.ExecuteGET<import("../../models/Modifier").IModifier, {}>;
export declare const postModifier: Backend.ExecutePOST<import("../../models/Modifier").IModifier>;
export declare const patchModifier: Backend.ExecutePATCH<import("../../models/Modifier").IModifier>;
export type GetModifiersExecutor = typeof getModifiers;
export type PostModifierExecutor = typeof postModifier;
export type PatchModifierExecutor = typeof patchModifier;
