/** Server build checks intermediate types. This module is never imported at runtime. */
import { createReadContext } from "@n/adira.backend.ts";
import { schema } from "@n/adira.core.ts";
import type { RequestContext } from "../../harness/telemetry";
import type { AccountIntermediate } from "../../server/accounts/details.adira";
import type { FinanceIntermediate } from "../../server/accounts/finance.adira";
import type { Id } from "../../server/database/models";
import { Accounts } from "../../server/database/models";
import type { BatchedOrderIntermediate } from "../../server/orders/fulfillment-batched.adira";
import type { FulfillmentOrderIntermediate } from "../../server/orders/fulfillment.adira";
import type { FulfillmentLineIntermediate } from "../../server/orders/items.adira";
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
type NativeNumber = Expect<
  Equal<FulfillmentLineIntermediate["shortageUnits"], number>
>;
type RetainedJoinKey = Expect<
  Equal<FulfillmentLineIntermediate["orderId"], Id>
>;
type SummedNativeNumber = Expect<
  Equal<FulfillmentOrderIntermediate["shortageUnits"], number>
>;
type CallbackNumber = Expect<
  Equal<FulfillmentOrderIntermediate["fulfillmentScore"], number>
>;
type BatchedNumber = Expect<
  Equal<BatchedOrderIntermediate["shortageUnits"], number>
>;
type BatchedOutput = Expect<
  Equal<
    BatchedOrderIntermediate["shortageSummary"],
    { readonly shortageUnits: number } | null
  >
>;
type Average = Expect<
  Equal<AccountIntermediate["recentOrderAverage"], number | null>
>;
type Min = Expect<Equal<AccountIntermediate["recentOrderMin"], number | null>>;
type Max = Expect<Equal<AccountIntermediate["recentOrderMax"], number | null>>;
type Count = Expect<Equal<AccountIntermediate["recentOrderCount"], number>>;
type First = Expect<
  Equal<
    AccountIntermediate["latestPaidOrder"],
    { readonly netCents: number } | null
  >
>;
type Finances = Expect<
  Equal<
    FinanceIntermediate["revenue"],
    {
      readonly grossRevenueCents: number;
      readonly refundedCents: number;
      readonly revenueOrderCount: number;
    } | null
  >
>;
type CustomGrouping = Expect<
  Equal<
    AccountIntermediate["portfolio"],
    {
      readonly revenueCents: number;
      readonly largestAccountCents: number;
    } | null
  >
>;

export function checkIntermediates(
  row: AccountIntermediate,
  line: FulfillmentLineIntermediate,
) {
  // @ts-expect-error The native output schema infers a number.
  const badNative: string = line.shortageUnits;
  // @ts-expect-error A missing relation remains nullable after a typed batch load.
  const badLoaded: number = row.portfolio.revenueCents;
  // @ts-expect-error The complete statistics do not expose arbitrary selected order columns.
  row.latestPaidOrder?.number;
  return { badNative, badLoaded };
}

export function checkCustomProviderContract() {
  return createReadContext<RequestContext>()
    .mongo.from(Accounts)
    .related({
      requires: ["managerId"],
      output: schema.object({ amount: schema.number() }),
      resolveBatch: async (input) => {
        const tenant: Id = input.context.tenantId;
        // @ts-expect-error Custom providers receive parents and context, without query intent.
        input.query;
        return input.parents.map(({ ref, row }) => {
          const manager: Id = row.managerId;
          // @ts-expect-error Provider inputs contain only declared requirements.
          row.creditLimitCents;
          return { ref, rows: [{ amount: manager.equals(tenant) ? 1 : 0 }] };
        });
      },
    });
}
