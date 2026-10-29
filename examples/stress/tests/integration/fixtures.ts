import mongoose from "mongoose";
import assert from "node:assert/strict";
import { after, before } from "node:test";
import { listen } from "../../harness/http/app";
import { temporaryMongo } from "../../harness/mongo";
import { seed } from "../../harness/seed";
import { monitor } from "../../harness/telemetry";
import { connect } from "../../server/database/models";

export let db: Awaited<ReturnType<typeof temporaryMongo>> | undefined,
  host: Awaited<ReturnType<typeof listen>> | undefined;

before(async () => {
  db = await temporaryMongo();
  await connect(db.uri);
  await seed("smoke", false, () => {});
  monitor();
  host = await listen("both", 0);
});

after(async () => {
  if (host)
    await new Promise<void>((resolve) => host!.server.close(() => resolve()));
  await mongoose.disconnect();
  await db?.stop();
});

export async function customRead(
  entity: "accounts" | "orders",
  query: object,
  backend = "adira",
) {
  const response = await fetch(
    host!.url +
      `/api/${backend}/${entity}?query=${encodeURIComponent(JSON.stringify(query))}`,
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body;
}

export async function selectedMetrics(
  entity: "accounts" | "products",
  ids: string[],
  select: object,
) {
  const query = {
    select,
    where: { $or: ids.map((id) => ({ id: { $eq: id } })) },
    orderBy: { id: "asc" },
    page: { limit: ids.length },
  };
  const response = await fetch(
    host!.url +
      `/api/adira/${entity}?query=${encodeURIComponent(JSON.stringify(query))}`,
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.rows.length, ids.length);
  return body.rows;
}
