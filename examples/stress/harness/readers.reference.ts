import { account360 } from "../server/accounts/details.reference";
import { referenceDirectory } from "../server/accounts/directory.reference";
import { referenceFinances } from "../server/accounts/finance.reference";
import { referencePortfolio } from "../server/accounts/portfolio.reference";
import { referenceRevenueQuality } from "../server/accounts/revenue-quality.reference";
import { referenceRisk } from "../server/accounts/risk.reference";
import { referenceNestedTriage } from "../server/accounts/triage.reference";
import { referenceFulfillment } from "../server/orders/fulfillment.reference";
import { referenceOrderOperations } from "../server/orders/operations.reference";
import { replenishment } from "../server/products/replenishment.reference";
import { type RequestContext } from "./telemetry";
import type { WorkloadId } from "./workloads";

const referenceViews = {
  directory: referenceDirectory,
  finances: referenceFinances,
  risk: referenceRisk,
  account360,
  orderOps: referenceOrderOperations,
  replenishment,
  revenueQuality: referenceRevenueQuality,
  fulfillment: referenceFulfillment,
  nestedTriage: referenceNestedTriage,
  portfolioConcentration: referencePortfolio,
};

export async function executeReference(
  view: WorkloadId,
  c: RequestContext,
): Promise<{
  rows: unknown[];
}> {
  return referenceViews[view](c);
}

export { referenceOrderOperations } from "../server/orders/operations.reference";

export { referenceDirectory } from "../server/accounts/directory.reference";

export { referenceFinances } from "../server/accounts/finance.reference";

export { referenceRisk } from "../server/accounts/risk.reference";

export { referenceVolatility } from "../server/accounts/history.reference";
