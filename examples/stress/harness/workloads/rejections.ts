/** Intentionally invalid requests, also exercised in frontend/inference.ts. */
export const expressivityProbes = [
  {
    id: "relationQuantifier",
    query: {
      select: { id: true },
      where: { orders: { $some: { priority: { $gte: 80 } } } },
    },
    boundary:
      "Arbitrary relation quantifiers require a backend-declared predicate.",
  },
  {
    id: "relationAlias",
    query: {
      select: {
        urgentOrders: {
          select: { id: true },
          where: { priority: { $gte: 80 } },
        },
      },
    },
    boundary:
      "Two differently filtered views of one relation need separate declared relation names or requests.",
  },
  {
    id: "computedArguments",
    query: { select: { recentOrderAverage: { since: 123 } } },
    boundary:
      "Computed scalar fields have fixed backend dependencies, without frontend-supplied arguments.",
  },
  {
    id: "arbitraryGrouping",
    query: { select: { id: true }, groupBy: ["region"] },
    boundary:
      "Frontend grouping is deliberately outside the REST resource contract.",
  },
  {
    id: "predicateOperand",
    query: {
      select: { id: true },
      where: { hasRecentEscalation: { $eq: "yes" } },
    },
    boundary:
      "Backend-approved predicates still enforce their declared operand types.",
  },
] as const;
