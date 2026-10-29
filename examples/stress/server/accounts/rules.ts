export const regions = ["EU", "NA", "APAC", "LATAM"] as const;

export const tiers = ["starter", "growth", "enterprise"] as const;

export interface RiskInputs {
  netRevenueCents: number;
  openTicketCount: number;
  lateShipmentCount: number;
  creditLimitCents: number;
  exposureCents: number;
}

export function riskScore(row: RiskInputs): number {
  const utilization = row.exposureCents / Math.max(1, row.creditLimitCents);
  return Math.min(
    100,
    Math.round(
      Math.min(35, utilization * 25) +
        Math.min(35, row.openTicketCount * 7) +
        Math.min(25, row.lateShipmentCount * 4) +
        (row.netRevenueCents < 20000 ? 5 : 0),
    ),
  );
}

export const riskBand = (score: number) =>
  score >= 70 ? "critical" : score >= 40 ? "watch" : "healthy";

export const marginBps = (net: number, cost: number) =>
  net <= 0 ? 0 : Math.round(((net - cost) * 10000) / net);

export const shareBps = (part: number, total: number) =>
  total <= 0 ? 0 : Math.round((part * 10000) / total);

export function volatility(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = values
    .map((value) => Math.abs(value - median))
    .sort((a, b) => a - b);
  return deviations[Math.floor(deviations.length / 2)];
}
