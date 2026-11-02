import type { Request, Response } from "express";
import type { Document, Model } from "mongoose";
import {
  Backend,
  Frontend,
  ReadQuery,
  schema,
  defineResource,
  field,
  when,
} from "@n/adira.core.ts";
import { defineRead, mongo, PlanRow } from "../read";
import {
  Categories,
  Creators,
  CategoryResource,
  categorySource,
  creatorSource,
  filters,
  relations,
  getCategories,
} from "./fixtures";

function expectType<T>(value: T): void {
  void value;
}
declare const documentModel: Model<{ name: string; stock: number } & Document>;
const fromDocumentModel = mongo.from(documentModel);
declare const documentRow: PlanRow<typeof fromDocumentModel>;
expectType<string>(documentRow.name);
// @ts-expect-error Models using the existing Row & Document pattern retain real field types.
expectType<number>(documentRow.name);
// @ts-expect-error A Mongoose Document does not make all fields available.
fromDocumentModel.derive("bad", (e) => e.field("nonexistent"));
// @ts-expect-error Aggregation rows do not have Mongoose document methods.
fromDocumentModel.derive("bad", (e) => e.field("save"));
const native = mongo
  .from(Categories)
  .derive("total", (e) => e.add(e.field("subtotal"), e.field("tax")))
  .project(["_id", "total"]);
type NativeRow = PlanRow<typeof native>;
declare const nativeRow: NativeRow;
expectType<number>(nativeRow.total);
// @ts-expect-error Projection removes other source fields.
nativeRow.name;
// @ts-expect-error Native expressions reject nonexistent fields.
native.derive("x", (e) => e.field("missing"));
mongo
  .from(Categories)
  // @ts-expect-error Arithmetic requires numeric expressions.
  .derive("x", (e) => e.add(e.field("name"), e.field("tax")));

const mixed = native
  .toApp()
  .derive("label", ["total"], async (row) => row.total.toFixed(2));
declare const mixedRow: PlanRow<typeof mixed>;
expectType<string>(mixedRow.label);
// @ts-expect-error Dependencies must exist after projection.
mixed.derive("bad", ["name"], (row) => row.name);
mixed.derive("bad", ["total"], (row) => {
  // @ts-expect-error Only declared dependencies are available.
  return row._id;
});
// @ts-expect-error An application plan cannot silently re-enter MongoDB.
mixed.toMongo();
// @ts-expect-error Native helpers are unavailable after crossing into application work.
mixed.native({ stages: [], output: schema.object({ label: schema.string() }) });

const raw = native.native({
  stages: [{ $set: { score: 1 } }],
  output: schema.object({ score: schema.number() }),
});
declare const rawRow: PlanRow<typeof raw>;
expectType<number>(rawRow.score);
// @ts-expect-error Raw output comes from the schema, not an unchecked type assertion.
expectType<string>(rawRow.score);

const needsDisplayName = defineResource({ displayName: field.string() });
// @ts-expect-error The source must produce every public scalar field.
defineRead(needsDisplayName, { source: mongo.from(Categories) });
// @ts-expect-error All declared relation fields need implementations.
defineRead(CategoryResource, { source: categorySource, filters });
defineRead(CategoryResource, {
  source: categorySource,
  relations,
  // @ts-expect-error Named predicate operators require implementations.
  filters: { eligible: filters.eligible },
});
defineRead(CategoryResource, {
  source: categorySource,
  // @ts-expect-error To-one and to-many implementations cannot be interchanged.
  relations: { ...relations, createdBy: relations.products },
  filters,
});
categorySource.one(getCategories.__resource, {
  plan: categorySource,
  localField: "name",
  // @ts-expect-error Join key types must be compatible.
  foreignField: "isActive",
  relations,
  filters,
});
categorySource.appCondition({
  requires: ["name"],
  // @ts-expect-error Application predicates must return a boolean.
  evaluate: (row) => row.name,
});

defineRead(CategoryResource, {
  source: categorySource,
  relations,
  filters: {
    ...filters,
    eligible: {
      $eq: (expected) => {
        expectType<boolean>(expected);
        return categorySource.appCondition({
          requires: ["isActive"],
          evaluate: (row) => row.isActive === expected,
        });
      },
    },
    name: {
      $startsWith: (value) => {
        expectType<string>(value);
        return categorySource.condition((e) =>
          e.startsWith(e.field("name"), value),
        );
      },
    },
  },
});

const response = getCategories({
  select: { name: true, createdBy: { select: { initials: true } } },
  where: {
    $or: [
      { name: { $startsWith: "A" } },
      { $not: { eligible: { $eq: false } } },
    ],
  },
});
type Row = Awaited<typeof response>["rows"][number];
declare const result: Row;
expectType<string>(result.name);
expectType<string | undefined>(result.createdBy?.initials);
// @ts-expect-error Unselected public fields are absent.
result.slug;
// @ts-expect-error Nested selections are precise.
result.createdBy?.name;
declare const showName: boolean;
const conditional = getCategories({
  select: { id: true, name: when(showName, () => true) },
});
declare const conditionalRow: Awaited<typeof conditional>["rows"][number];
expectType<string | undefined>(conditionalRow.name);
// @ts-expect-error A conditional selection is not guaranteed to be present.
expectType<string>(conditionalRow.name);
// @ts-expect-error Unknown root fields are rejected even alongside valid fields.
getCategories({ select: { name: true, secret: true } });
getCategories({
  // @ts-expect-error Unknown nested fields are rejected.
  select: { createdBy: { select: { name: true, secret: true } } },
});
// @ts-expect-error Comparison operands retain scalar types.
getCategories({ select: { name: true }, where: { total: { $gte: "20" } } });
// @ts-expect-error Non-filterable fields do not become predicates.
getCategories({ select: { name: true }, where: { slug: { $eq: "art" } } });
getCategories({
  select: { name: true },
  // @ts-expect-error Unknown predicates are rejected even alongside valid predicates.
  where: { name: { $eq: "Art" }, secret: { $eq: true } },
});
getCategories({
  select: { name: true },
  // @ts-expect-error Disabled operators are rejected even alongside enabled operators.
  where: { total: { $gte: 1, $eq: 1 } },
});
// @ts-expect-error Frontend aggregation is not part of the resource API.
getCategories({ select: { name: true }, groupBy: ["name"] });
// @ts-expect-error Empty Boolean groups are rejected statically.
getCategories({ select: { name: true }, where: { $or: [] } });
// @ts-expect-error Only explicitly sortable fields are allowed.
getCategories({ select: { name: true }, orderBy: { slug: "asc" } });
getCategories({
  // @ts-expect-error To-one relation selection does not accept collection pagination.
  select: { createdBy: { select: { name: true }, page: { limit: 1 } } },
});

type GetCategoriesFn = typeof getCategories;
async function expressHandler(
  req: Request<
    Record<string, string>,
    unknown,
    unknown,
    Backend.InferHandlerParams<GetCategoriesFn>
  >,
  res: Response<
    | Backend.InferHandlerResponse<GetCategoriesFn>
    | { error: true; message: string }
  >,
) {
  const executed = await getCategories(req.query);
  res.send(executed);
  res.send({ error: true, message: "Failed" });
  // @ts-expect-error Hand-built results lack the managed execution marker.
  res.send({ rows: [{ name: "wrong" }] });
  expectType<string | undefined>(executed.rows[0].slug);
  // @ts-expect-error A dynamic request does not imply every public field was selected.
  expectType<string>(executed.rows[0].slug);
}

type API = {
  "/api/categories/composable": {
    GET: {
      RequestQuery: Backend.InferHandlerParams<GetCategoriesFn>;
      ResponseBody:
        | Backend.InferHandlerResponse<GetCategoriesFn>
        | { error: true; message: string };
    };
  };
};
declare const createClient: Frontend.CreateAxiosApiClient;
const api = createClient<API>("http://localhost");
const request = api(
  "/categories/composable",
  "GET",
)({ query: { select: { name: true, total: true } } });
async function client() {
  const output = await request.run();
  if ("error" in output) return;
  expectType<number>(output.rows[0].total);
  // @ts-expect-error The frontend response only contains selected fields.
  output.rows[0].slug;
}

const small = defineResource({ name: field.string() });
const changed = mongo
  .from(Creators)
  .toApp()
  .map((row) => ({ name: row.name.toUpperCase() }));
defineRead(small, { source: changed });
// @ts-expect-error Output types are checked at the public contract boundary.
defineRead(small, {
  source: mongo
    .from(Creators)
    .toApp()
    .map(() => ({ name: 42 })),
});

export {};
