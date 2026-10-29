import { useState } from "react";
type UsePasswordReturn<T extends string> = {
    [K in `${T}Password`]: string;
} & {
    [K in `set${T}Password`]: React.Dispatch<React.SetStateAction<string>>;
} & {
    [K in `${T}PasswordError`]: string[];
} & {
    [K in `set${T}PasswordError`]: React.Dispatch<React.SetStateAction<string[]>>;
};
export const usePassword = <T extends string>(id: T): UsePasswordReturn<T> => {
    const [passwordError, setPasswordError] = useState<string[]>([]);
    const [password, setPassword] = useState("");
    return {
        [`${id}Password`]: password,
        [`set${id}Password`]: setPassword,
        [`${id}PasswordError`]: passwordError,
        [`set${id}PasswordError`]: setPasswordError,
    } as UsePasswordReturn<T>;
};
