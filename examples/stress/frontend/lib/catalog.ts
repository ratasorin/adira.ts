import { readRecord, schema, type SchemaValue } from "@n/adira.core.ts";

export const catalogSchema = schema.object({
  metadata: schema.object({
    profile: schema.string(),
    asOf: schema.number(),
    counts: schema.custom((value: unknown) =>
      Object.fromEntries(
        Object.entries(readRecord(value, "dataset counts")).map(
          ([name, count]) => [name, schema.number().parse(count)],
        ),
      ),
    ),
  }),
  tenants: schema.array(
    schema.object({ index: schema.number(), name: schema.string() }),
  ),
  mode: schema.enum(["adira", "reference", "both"]),
});

export type Catalog = SchemaValue<typeof catalogSchema>;
