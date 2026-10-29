import { type RequestContext } from "../../harness/telemetry";
import { Accounts } from "../database/models";
import { base, key } from "../database/records";

export async function referenceDirectory(c: RequestContext) {
  const filter = {
    ...base(c),
    region: { $in: ["EU", "NA"] },
    tier: { $ne: "starter" },
  };
  const accounts = await Accounts.collection
    .find(filter, { projection: { name: 1, tier: 1, region: 1 } })
    .sort({ name: 1, _id: 1 })
    .limit(40)
    .toArray();
  return {
    rows: accounts.map((a) => ({
      id: key(a._id),
      name: a.name,
      tier: a.tier,
      region: a.region,
    })),
  };
}
