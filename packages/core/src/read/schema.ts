/** A small runtime schema interface; adapters can also supply their own parser. */
export interface ValueSchema<T> {
  parse(value: unknown): T;
  /** Optional provider metadata. Custom parsers stay application work by default. */
  readonly native?: {
    readonly type: "number" | "string" | "boolean" | "enum";
    readonly nullable: boolean;
    readonly values?: readonly string[];
  };
}

export type SchemaValue<S> = S extends ValueSchema<infer T> ? T : never;

export class ReadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadValidationError";
  }
}

export function readRecord(
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReadValidationError(`${path}: expected an object`);
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new ReadValidationError(`${path}: expected a plain object`);
  }
  return value as Record<string, unknown>;
}

export function assertReadKey(key: string): void {
  if (
    !key ||
    key.startsWith("$") ||
    key.startsWith("__adira_") ||
    key.includes(".") ||
    ["__proto__", "prototype", "constructor"].includes(key)
  ) {
    throw new ReadValidationError(`Invalid resource or stage field '${key}'`);
  }
}

export class ObjectSchema<
  Fields extends Record<string, ValueSchema<unknown>>,
> implements ValueSchema<{ [K in keyof Fields]: SchemaValue<Fields[K]> }> {
  constructor(readonly fields: Fields) {
    Object.keys(fields).forEach(assertReadKey);
  }

  parse(value: unknown): { [K in keyof Fields]: SchemaValue<Fields[K]> } {
    const input = readRecord(value, "row");
    const output: Record<string, unknown> = {};
    for (const [key, parser] of Object.entries(this.fields)) {
      try {
        output[key] = parser.parse(input[key]);
      } catch (error) {
        throw new ReadValidationError(
          `${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return output as { [K in keyof Fields]: SchemaValue<Fields[K]> };
  }
}

export const schema = {
  string(): ValueSchema<string> {
    return {
      native: { type: "string", nullable: false },
      parse(value) {
        if (typeof value !== "string")
          throw new ReadValidationError("expected a string");
        return value;
      },
    };
  },
  number(): ValueSchema<number> {
    return {
      native: { type: "number", nullable: false },
      parse(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw new ReadValidationError("expected a finite number");
        }
        return value;
      },
    };
  },
  boolean(): ValueSchema<boolean> {
    return {
      native: { type: "boolean", nullable: false },
      parse(value) {
        if (typeof value !== "boolean")
          throw new ReadValidationError("expected a boolean");
        return value;
      },
    };
  },
  enum<const Values extends readonly string[]>(
    values: Values,
  ): ValueSchema<Values[number]> {
    return {
      native: { type: "enum", nullable: false, values },
      parse(value) {
        if (typeof value !== "string" || !values.includes(value)) {
          throw new ReadValidationError(
            `expected one of: ${values.join(", ")}`,
          );
        }
        return value;
      },
    };
  },
  nullable<T>(inner: ValueSchema<T>): ValueSchema<T | null> {
    return {
      ...(inner.native ? { native: { ...inner.native, nullable: true } } : {}),
      parse: (value) =>
        value === null || value === undefined ? null : inner.parse(value),
    };
  },
  array<T>(inner: ValueSchema<T>): ValueSchema<T[]> {
    return {
      parse(value) {
        if (!Array.isArray(value))
          throw new ReadValidationError("expected an array");
        return value.map((item) => inner.parse(item));
      },
    };
  },
  object<const Fields extends Record<string, ValueSchema<unknown>>>(
    fields: Fields,
  ): ObjectSchema<Fields> {
    return new ObjectSchema(fields);
  },
  custom<T>(parse: (value: unknown) => T): ValueSchema<T> {
    return { parse };
  },
};
