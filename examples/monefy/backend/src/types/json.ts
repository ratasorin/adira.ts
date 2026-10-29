import type { RefTo } from "@n/adira.core.ts";

/** The JSON representation of a model, retaining relation metadata for the SDK. */
export type Json<T, Depth extends readonly unknown[] = []> = Depth["length"] extends 8
  ? string
  : T extends { __: infer Serialized }
    ? T extends RefTo<infer Target>
      ? Serialized & RefTo<Json<Target, [...Depth, 0]>>
      : Serialized
    : T extends string
      ? "__refTo" extends keyof T
        ? T extends RefTo<infer Target> ? string & RefTo<Json<Target, [...Depth, 0]>> : T
        : T
    : T extends Date
      ? string
      : T extends string | number | boolean | null | undefined
        ? T
        : T extends readonly (infer Item)[]
          ? Json<Item, [...Depth, 0]>[]
          : T extends object
            ? { [Key in keyof T]: Json<T[Key], [...Depth, 0]> }
            : T;

export function json<T>(value: T): Json<T> {
  return JSON.parse(JSON.stringify(value)) as Json<T>;
}
