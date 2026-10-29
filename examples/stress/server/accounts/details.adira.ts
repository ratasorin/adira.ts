import type { PlanRow } from "@n/adira.backend.ts";
import { schema } from "@n/adira.core.ts";
import {
  AccountResource,
  readLimits as limits,
} from "../../contracts/resources";
import { reads } from "../read-context";
import { escalationStages } from "./escalation.adira";
import { accountSource } from "./history.adira";
import { manager, orders, tickets } from "./relations.adira";

export const readAccounts = reads.defineRead(AccountResource, {
  source: accountSource,
  relations: { manager, orders, tickets },
  limits,
  filters: {
    hasRecentEscalation: {
      $eq: (expected) =>
        accountSource.pipelineCondition({
          requires: ["_id", "tenantId"],
          preservesRows: true,
          stages: escalationStages,
          output: schema.object({
            recentEscalations: schema.array(
              schema.object({ priority: schema.number() }),
            ),
          }),
          test: (e) =>
            e.eq(e.gt(e.size(e.field("recentEscalations")), 0), expected),
        }),
    },
  },
});

export type AccountIntermediate = PlanRow<typeof accountSource>;
