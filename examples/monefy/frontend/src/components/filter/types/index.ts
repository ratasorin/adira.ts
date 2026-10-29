import { FC, ReactNode } from "react";
export type FIELD_MODES = "MULTIPLE" | "BINARY" | "SEARCH" | "RANGE";
export type Primitive = string | number | undefined;
// Base interface shared by all field types
interface BaseField<T, K extends keyof T = keyof T> {
    key: K;
    renderKey?: (k: string) => string;
    icon?: React.ReactNode;
    value: (item: T[K]) => Primitive | Primitive[];
}
interface RangeFieldProps {
    mode: "RANGE";
    renderMin: (value: string) => React.ReactNode;
    renderMax: (value: string) => React.ReactNode;
}
// Specific version when mode is "RANGE"
interface RangeField<T, K extends keyof T = keyof T> extends BaseField<T, K>, RangeFieldProps {
}
// Versions for other modes
interface OtherField<T, K extends keyof T = keyof T> extends BaseField<T, K> {
    mode: Exclude<FIELD_MODES, "RANGE">;
}
// Discriminated union
export type Field<T, K extends keyof T = keyof T> = RangeField<T, K> | OtherField<T, K>;
// Shared base
interface BaseFlatField {
    key: string | number | symbol;
    icon?: ReactNode;
    renderKey?: (k: string) => string;
    values: Primitive[];
}
interface RangeFlatField extends BaseFlatField, RangeFieldProps {
}
interface OtherFlatField extends BaseFlatField {
    mode: Exclude<FIELD_MODES, "RANGE">;
}
export type FlatField = RangeFlatField | OtherFlatField;
export interface FilterProps<T> {
    data: T[];
    fields: {
        [K in keyof T]: Field<T, K>;
    }[keyof T][];
    RenderUnit: FC<{
        item: T;
    }>;
}
