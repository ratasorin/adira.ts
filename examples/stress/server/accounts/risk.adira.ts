import { count } from "../../harness/telemetry";
import { Exposure, exposureOutput, loadExposure } from "./exposure.provider";
import { financeSource, marginSource } from "./finance.adira";
import { shipments, tickets } from "./relations.adira";
import { riskBand, riskScore } from "./rules";

const exposure = financeSource
  .related({
    requires: ["_id"],
    output: exposureOutput,
    resolveBatch: loadExposure,
  })
  .one(Exposure);

export const riskSource = marginSource
  .load(
    "openTicketCount",
    tickets.count({ where: { status: { $in: ["open", "pending"] } } }),
  )
  .load(
    "lateShipmentCount",
    shipments.count({ where: { late: { $eq: true } } }),
  )
  .load("exposure", exposure.get({ select: { exposureCents: true } }))
  .derive(
    "riskScore",
    [
      "netRevenueCents",
      "openTicketCount",
      "lateShipmentCount",
      "creditLimitCents",
      "exposure",
    ],
    (r, c) => {
      count(c, "riskScore");
      return riskScore({ ...r, exposureCents: r.exposure?.exposureCents ?? 0 });
    },
  )
  .derive("riskBand", ["riskScore"], (r, c) => {
    count(c, "riskBand");
    return riskBand(r.riskScore);
  });
