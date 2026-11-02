import { type RequestContext } from "../../harness/telemetry";
import { base } from "../database/records";

export const eligibleAccounts = (c: RequestContext) => ({
  ...base(c),
  region: { $in: ["EU", "NA"] },
  tier: { $ne: "starter" },
});
