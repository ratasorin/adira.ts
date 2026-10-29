import mongoose, { Schema, Types, type PipelineStage } from "mongoose";

// Aggregation does not apply Mongoose's normal query casting. Resolve filters
// against the schema, including references that Adira joins before filtering.
function fieldType(schema: Schema, field: string): string | undefined {
  const direct = schema.path(field);
  if (direct) return direct.instance;
  const parts = field.split(".");
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = schema.path(parts.slice(0, i).join("."));
    const ref: unknown = parent?.options?.ref;
    if (typeof ref === "string" && mongoose.models[ref]) {
      return fieldType(mongoose.models[ref].schema, parts.slice(i).join("."));
    }
  }
  return undefined;
}

function castValue(value: unknown, instance: string | undefined): unknown {
  if (Array.isArray(value)) return value.map(item => castValue(item, instance));
  if (value instanceof Types.ObjectId || value instanceof Date) return value;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, castValue(item, instance)]));
  }
  if (typeof value === "string" && instance === "ObjectId" && Types.ObjectId.isValid(value)) return new Types.ObjectId(value);
  if (typeof value === "string" && instance === "Date" && Number.isFinite(Date.parse(value))) return new Date(value);
  return value;
}

function castMatch(match: Record<string, unknown>, schema: Schema): void {
  for (const [field, value] of Object.entries(match)) {
    if (["$and", "$or", "$nor"].includes(field) && Array.isArray(value)) {
      for (const condition of value) {
        if (condition && typeof condition === "object") castMatch(condition, schema);
      }
    } else {
      match[field] = castValue(value, fieldType(schema, field));
    }
  }
}

mongoose.plugin(schema => {
  schema.pre("aggregate", function () {
    const visit = (stages: PipelineStage[]) => {
      for (const stage of stages) {
        if ("$match" in stage && stage.$match && typeof stage.$match === "object") castMatch(stage.$match as Record<string, unknown>, this.model().schema);
        if ("$facet" in stage && stage.$facet && typeof stage.$facet === "object") {
          for (const branch of Object.values(stage.$facet)) if (Array.isArray(branch)) visit(branch);
        }
      }
    };
    if (this.model().schema.path("deletedAt")) this.pipeline().unshift({ $match: { deletedAt: null } });
    visit(this.pipeline());
  });
});
