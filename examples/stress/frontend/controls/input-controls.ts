import { schema, type ValueSchema } from "@n/adira.core.ts";

export type ParseResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

/** Value validation and text conversion, independent of UI and state management. */
export interface InputParser<T> {
  readonly schema: ValueSchema<T>;
  parse: (raw: unknown) => T;
  safeParse: (raw: unknown) => ParseResult<T>;
  parseText: (text: string) => T;
  safeParseText: (text: string) => ParseResult<T>;
  format: (value: T) => string;
}

function attempt<T>(parse: () => T): ParseResult<T> {
  try {
    return { success: true, value: parse() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function defineInputParser<T>(config: {
  schema: ValueSchema<T>;
  parseText: (text: string) => T;
  format: (value: T) => string;
}): InputParser<T> {
  const parse = (raw: unknown) => config.schema.parse(raw);
  const parseText = (text: string) => parse(config.parseText(text));
  return {
    schema: config.schema,
    parse,
    safeParse: (raw) => attempt(() => parse(raw)),
    parseText,
    safeParseText: (text) => attempt(() => parseText(text)),
    format: (value) => config.format(parse(value)),
  };
}

export function nonNullable<T>(
  value: ValueSchema<T>,
): ValueSchema<NonNullable<T>> {
  return {
    ...(value.native ? { native: { ...value.native, nullable: false } } : {}),
    parse(raw) {
      const parsed = value.parse(raw);
      if (parsed === null || parsed === undefined)
        throw new Error("Null is not an operand for this operator.");
      return parsed;
    },
  };
}

const scalarText = (value: string | number | boolean | null) =>
  value === null ? "" : String(value);

export function stringParser<T extends string | null>(
  value: ValueSchema<T>,
): InputParser<T> {
  return defineInputParser({
    schema: value,
    parseText: (text) => value.parse(text),
    format: scalarText,
  });
}

export function numberParser<T extends number | null>(
  value: ValueSchema<T>,
): InputParser<T> {
  return defineInputParser({
    schema: value,
    parseText: (text) => {
      if (!text.trim()) throw new Error("Enter a number.");
      return value.parse(Number(text));
    },
    format: scalarText,
  });
}

export function booleanParser<T extends boolean | null>(
  value: ValueSchema<T>,
): InputParser<T> {
  return defineInputParser({
    schema: value,
    parseText: (text) => {
      if (text !== "true" && text !== "false")
        throw new Error("Expected a Boolean value.");
      return value.parse(text === "true");
    },
    format: scalarText,
  });
}

export function enumParser<T extends string | null>(
  value: ValueSchema<T>,
): InputParser<T> {
  return stringParser(value);
}

export function listParser<T>(
  element: InputParser<T>,
): InputParser<readonly T[]> {
  return defineInputParser<readonly T[]>({
    schema: schema.array({ parse: element.parse }),
    parseText: (text) => {
      if (!text.trim()) return [];
      if (text.trimStart().startsWith("[")) {
        const raw: unknown = JSON.parse(text);
        if (!Array.isArray(raw)) throw new Error("Expected an array.");
        return raw.map((value: unknown) => element.parse(value));
      }
      return text
        .split(/[,\n]/)
        .map((value) => element.parseText(value.trim()));
    },
    format: (values) => JSON.stringify(values),
  });
}
