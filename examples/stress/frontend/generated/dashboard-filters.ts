/** Generated dashboard conveniences. Public parsers in controls.ts do not depend on this module. */
import type * as contracts from "../../contracts/resources";
import * as inputs from "./controls";
import {
  defineFilterEditors,
  ruleFor,
  type FilterChoice,
  type FilterRuleFactories,
} from "../controls/filter-state";
type R_AgentResource = (typeof contracts)["AgentResource"];
const AgentResourceRule = ruleFor<R_AgentResource>();
export const AgentResourceFilterRules = {
  id: {
    $eq: AgentResourceRule(
      inputs.AgentResourceFilters["id"]["$eq"],
      (value) => ({ id: { $eq: value } }),
    ),
  },
  name: {
    $eq: AgentResourceRule(
      inputs.AgentResourceFilters["name"]["$eq"],
      (value) => ({ name: { $eq: value } }),
    ),
    $in: AgentResourceRule(
      inputs.AgentResourceFilters["name"]["$in"],
      (value) => ({ name: { $in: value } }),
    ),
    $startsWith: AgentResourceRule(
      inputs.AgentResourceFilters["name"]["$startsWith"],
      (value) => ({ name: { $startsWith: value } }),
    ),
  },
  region: {
    $eq: AgentResourceRule(
      inputs.AgentResourceFilters["region"]["$eq"],
      (value) => ({ region: { $eq: value } }),
    ),
    $in: AgentResourceRule(
      inputs.AgentResourceFilters["region"]["$in"],
      (value) => ({ region: { $in: value } }),
    ),
    $startsWith: AgentResourceRule(
      inputs.AgentResourceFilters["region"]["$startsWith"],
      (value) => ({ region: { $startsWith: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_AgentResource>;
const AgentResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => AgentResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AgentResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  name: {
    id: "name",
    field: "name",
    predicate: false,
    create: () => AgentResourceFilterRules["name"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AgentResourceFilterRules["name"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AgentResourceFilterRules["name"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () => AgentResourceFilterRules["name"]["$startsWith"].create(),
      },
    ],
  },
  region: {
    id: "region",
    field: "region",
    predicate: false,
    create: () => AgentResourceFilterRules["region"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AgentResourceFilterRules["region"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AgentResourceFilterRules["region"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          AgentResourceFilterRules["region"]["$startsWith"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_AgentResource>]: FilterChoice<R_AgentResource>;
};
export const AgentResourceFilterEditors = defineFilterEditors<R_AgentResource>({
  fields: Object.values(AgentResourceChoices),
  combine: {
    and: (children) => ({ $and: children }),
    or: (children) => ({ $or: children }),
    not: (child) => ({ $not: child }),
  },
});
type R_AccountMini = (typeof contracts)["AccountMini"];
const AccountMiniRule = ruleFor<R_AccountMini>();
export const AccountMiniFilterRules = {
  id: {
    $eq: AccountMiniRule(inputs.AccountMiniFilters["id"]["$eq"], (value) => ({
      id: { $eq: value },
    })),
  },
  name: {
    $eq: AccountMiniRule(inputs.AccountMiniFilters["name"]["$eq"], (value) => ({
      name: { $eq: value },
    })),
    $in: AccountMiniRule(inputs.AccountMiniFilters["name"]["$in"], (value) => ({
      name: { $in: value },
    })),
    $startsWith: AccountMiniRule(
      inputs.AccountMiniFilters["name"]["$startsWith"],
      (value) => ({ name: { $startsWith: value } }),
    ),
  },
  region: {
    $eq: AccountMiniRule(
      inputs.AccountMiniFilters["region"]["$eq"],
      (value) => ({ region: { $eq: value } }),
    ),
    $in: AccountMiniRule(
      inputs.AccountMiniFilters["region"]["$in"],
      (value) => ({ region: { $in: value } }),
    ),
    $startsWith: AccountMiniRule(
      inputs.AccountMiniFilters["region"]["$startsWith"],
      (value) => ({ region: { $startsWith: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_AccountMini>;
const AccountMiniChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => AccountMiniFilterRules["id"]["$eq"].create(),
    operators: [
      { id: "$eq", create: () => AccountMiniFilterRules["id"]["$eq"].create() },
    ],
  },
  name: {
    id: "name",
    field: "name",
    predicate: false,
    create: () => AccountMiniFilterRules["name"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountMiniFilterRules["name"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AccountMiniFilterRules["name"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () => AccountMiniFilterRules["name"]["$startsWith"].create(),
      },
    ],
  },
  region: {
    id: "region",
    field: "region",
    predicate: false,
    create: () => AccountMiniFilterRules["region"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountMiniFilterRules["region"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AccountMiniFilterRules["region"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () => AccountMiniFilterRules["region"]["$startsWith"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_AccountMini>]: FilterChoice<R_AccountMini>;
};
export const AccountMiniFilterEditors = defineFilterEditors<R_AccountMini>({
  fields: Object.values(AccountMiniChoices),
  combine: {
    and: (children) => ({ $and: children }),
    or: (children) => ({ $or: children }),
    not: (child) => ({ $not: child }),
  },
});
type R_InventoryResource = (typeof contracts)["InventoryResource"];
const InventoryResourceRule = ruleFor<R_InventoryResource>();
export const InventoryResourceFilterRules = {
  id: {
    $eq: InventoryResourceRule(
      inputs.InventoryResourceFilters["id"]["$eq"],
      (value) => ({ id: { $eq: value } }),
    ),
  },
  warehouse: {
    $eq: InventoryResourceRule(
      inputs.InventoryResourceFilters["warehouse"]["$eq"],
      (value) => ({ warehouse: { $eq: value } }),
    ),
    $in: InventoryResourceRule(
      inputs.InventoryResourceFilters["warehouse"]["$in"],
      (value) => ({ warehouse: { $in: value } }),
    ),
    $startsWith: InventoryResourceRule(
      inputs.InventoryResourceFilters["warehouse"]["$startsWith"],
      (value) => ({ warehouse: { $startsWith: value } }),
    ),
  },
  onHand: {
    $eq: InventoryResourceRule(
      inputs.InventoryResourceFilters["onHand"]["$eq"],
      (value) => ({ onHand: { $eq: value } }),
    ),
    $gte: InventoryResourceRule(
      inputs.InventoryResourceFilters["onHand"]["$gte"],
      (value) => ({ onHand: { $gte: value } }),
    ),
    $lt: InventoryResourceRule(
      inputs.InventoryResourceFilters["onHand"]["$lt"],
      (value) => ({ onHand: { $lt: value } }),
    ),
  },
  reserved: {
    $eq: InventoryResourceRule(
      inputs.InventoryResourceFilters["reserved"]["$eq"],
      (value) => ({ reserved: { $eq: value } }),
    ),
    $gte: InventoryResourceRule(
      inputs.InventoryResourceFilters["reserved"]["$gte"],
      (value) => ({ reserved: { $gte: value } }),
    ),
    $lt: InventoryResourceRule(
      inputs.InventoryResourceFilters["reserved"]["$lt"],
      (value) => ({ reserved: { $lt: value } }),
    ),
  },
  available: {
    $eq: InventoryResourceRule(
      inputs.InventoryResourceFilters["available"]["$eq"],
      (value) => ({ available: { $eq: value } }),
    ),
    $gte: InventoryResourceRule(
      inputs.InventoryResourceFilters["available"]["$gte"],
      (value) => ({ available: { $gte: value } }),
    ),
    $lt: InventoryResourceRule(
      inputs.InventoryResourceFilters["available"]["$lt"],
      (value) => ({ available: { $lt: value } }),
    ),
  },
  stockStatus: {
    $eq: InventoryResourceRule(
      inputs.InventoryResourceFilters["stockStatus"]["$eq"],
      (value) => ({ stockStatus: { $eq: value } }),
    ),
    $in: InventoryResourceRule(
      inputs.InventoryResourceFilters["stockStatus"]["$in"],
      (value) => ({ stockStatus: { $in: value } }),
    ),
    $startsWith: InventoryResourceRule(
      inputs.InventoryResourceFilters["stockStatus"]["$startsWith"],
      (value) => ({ stockStatus: { $startsWith: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_InventoryResource>;
const InventoryResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => InventoryResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => InventoryResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  warehouse: {
    id: "warehouse",
    field: "warehouse",
    predicate: false,
    create: () => InventoryResourceFilterRules["warehouse"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => InventoryResourceFilterRules["warehouse"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => InventoryResourceFilterRules["warehouse"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          InventoryResourceFilterRules["warehouse"]["$startsWith"].create(),
      },
    ],
  },
  onHand: {
    id: "onHand",
    field: "onHand",
    predicate: false,
    create: () => InventoryResourceFilterRules["onHand"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => InventoryResourceFilterRules["onHand"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => InventoryResourceFilterRules["onHand"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => InventoryResourceFilterRules["onHand"]["$lt"].create(),
      },
    ],
  },
  reserved: {
    id: "reserved",
    field: "reserved",
    predicate: false,
    create: () => InventoryResourceFilterRules["reserved"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => InventoryResourceFilterRules["reserved"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => InventoryResourceFilterRules["reserved"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => InventoryResourceFilterRules["reserved"]["$lt"].create(),
      },
    ],
  },
  available: {
    id: "available",
    field: "available",
    predicate: false,
    create: () => InventoryResourceFilterRules["available"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => InventoryResourceFilterRules["available"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          InventoryResourceFilterRules["available"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => InventoryResourceFilterRules["available"]["$lt"].create(),
      },
    ],
  },
  stockStatus: {
    id: "stockStatus",
    field: "stockStatus",
    predicate: false,
    create: () => InventoryResourceFilterRules["stockStatus"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          InventoryResourceFilterRules["stockStatus"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () =>
          InventoryResourceFilterRules["stockStatus"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          InventoryResourceFilterRules["stockStatus"]["$startsWith"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_InventoryResource>]: FilterChoice<R_InventoryResource>;
};
export const InventoryResourceFilterEditors =
  defineFilterEditors<R_InventoryResource>({
    fields: Object.values(InventoryResourceChoices),
    combine: {
      and: (children) => ({ $and: children }),
      or: (children) => ({ $or: children }),
      not: (child) => ({ $not: child }),
    },
  });
type R_ProductMini = (typeof contracts)["ProductMini"];
const ProductMiniRule = ruleFor<R_ProductMini>();
export const ProductMiniFilterRules = {
  id: {
    $eq: ProductMiniRule(inputs.ProductMiniFilters["id"]["$eq"], (value) => ({
      id: { $eq: value },
    })),
  },
  name: {
    $eq: ProductMiniRule(inputs.ProductMiniFilters["name"]["$eq"], (value) => ({
      name: { $eq: value },
    })),
    $in: ProductMiniRule(inputs.ProductMiniFilters["name"]["$in"], (value) => ({
      name: { $in: value },
    })),
    $startsWith: ProductMiniRule(
      inputs.ProductMiniFilters["name"]["$startsWith"],
      (value) => ({ name: { $startsWith: value } }),
    ),
  },
  sku: {
    $eq: ProductMiniRule(inputs.ProductMiniFilters["sku"]["$eq"], (value) => ({
      sku: { $eq: value },
    })),
    $in: ProductMiniRule(inputs.ProductMiniFilters["sku"]["$in"], (value) => ({
      sku: { $in: value },
    })),
    $startsWith: ProductMiniRule(
      inputs.ProductMiniFilters["sku"]["$startsWith"],
      (value) => ({ sku: { $startsWith: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_ProductMini>;
const ProductMiniChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => ProductMiniFilterRules["id"]["$eq"].create(),
    operators: [
      { id: "$eq", create: () => ProductMiniFilterRules["id"]["$eq"].create() },
    ],
  },
  name: {
    id: "name",
    field: "name",
    predicate: false,
    create: () => ProductMiniFilterRules["name"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductMiniFilterRules["name"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => ProductMiniFilterRules["name"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () => ProductMiniFilterRules["name"]["$startsWith"].create(),
      },
    ],
  },
  sku: {
    id: "sku",
    field: "sku",
    predicate: false,
    create: () => ProductMiniFilterRules["sku"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductMiniFilterRules["sku"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => ProductMiniFilterRules["sku"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () => ProductMiniFilterRules["sku"]["$startsWith"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_ProductMini>]: FilterChoice<R_ProductMini>;
};
export const ProductMiniFilterEditors = defineFilterEditors<R_ProductMini>({
  fields: Object.values(ProductMiniChoices),
  combine: {
    and: (children) => ({ $and: children }),
    or: (children) => ({ $or: children }),
    not: (child) => ({ $not: child }),
  },
});
type R_LineResource = (typeof contracts)["LineResource"];
const LineResourceRule = ruleFor<R_LineResource>();
export const LineResourceFilterRules = {
  id: {
    $eq: LineResourceRule(inputs.LineResourceFilters["id"]["$eq"], (value) => ({
      id: { $eq: value },
    })),
  },
  quantity: {
    $eq: LineResourceRule(
      inputs.LineResourceFilters["quantity"]["$eq"],
      (value) => ({ quantity: { $eq: value } }),
    ),
    $gte: LineResourceRule(
      inputs.LineResourceFilters["quantity"]["$gte"],
      (value) => ({ quantity: { $gte: value } }),
    ),
    $lt: LineResourceRule(
      inputs.LineResourceFilters["quantity"]["$lt"],
      (value) => ({ quantity: { $lt: value } }),
    ),
  },
  grossCents: {
    $eq: LineResourceRule(
      inputs.LineResourceFilters["grossCents"]["$eq"],
      (value) => ({ grossCents: { $eq: value } }),
    ),
    $gte: LineResourceRule(
      inputs.LineResourceFilters["grossCents"]["$gte"],
      (value) => ({ grossCents: { $gte: value } }),
    ),
    $lt: LineResourceRule(
      inputs.LineResourceFilters["grossCents"]["$lt"],
      (value) => ({ grossCents: { $lt: value } }),
    ),
  },
  marginCents: {
    $eq: LineResourceRule(
      inputs.LineResourceFilters["marginCents"]["$eq"],
      (value) => ({ marginCents: { $eq: value } }),
    ),
    $gte: LineResourceRule(
      inputs.LineResourceFilters["marginCents"]["$gte"],
      (value) => ({ marginCents: { $gte: value } }),
    ),
    $lt: LineResourceRule(
      inputs.LineResourceFilters["marginCents"]["$lt"],
      (value) => ({ marginCents: { $lt: value } }),
    ),
  },
  shortageUnits: {
    $eq: LineResourceRule(
      inputs.LineResourceFilters["shortageUnits"]["$eq"],
      (value) => ({ shortageUnits: { $eq: value } }),
    ),
    $gte: LineResourceRule(
      inputs.LineResourceFilters["shortageUnits"]["$gte"],
      (value) => ({ shortageUnits: { $gte: value } }),
    ),
    $lt: LineResourceRule(
      inputs.LineResourceFilters["shortageUnits"]["$lt"],
      (value) => ({ shortageUnits: { $lt: value } }),
    ),
  },
  placedAt: {
    $eq: LineResourceRule(
      inputs.LineResourceFilters["placedAt"]["$eq"],
      (value) => ({ placedAt: { $eq: value } }),
    ),
    $gte: LineResourceRule(
      inputs.LineResourceFilters["placedAt"]["$gte"],
      (value) => ({ placedAt: { $gte: value } }),
    ),
    $lt: LineResourceRule(
      inputs.LineResourceFilters["placedAt"]["$lt"],
      (value) => ({ placedAt: { $lt: value } }),
    ),
  },
  status: {
    $eq: LineResourceRule(
      inputs.LineResourceFilters["status"]["$eq"],
      (value) => ({ status: { $eq: value } }),
    ),
    $in: LineResourceRule(
      inputs.LineResourceFilters["status"]["$in"],
      (value) => ({ status: { $in: value } }),
    ),
    $startsWith: LineResourceRule(
      inputs.LineResourceFilters["status"]["$startsWith"],
      (value) => ({ status: { $startsWith: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_LineResource>;
const LineResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => LineResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => LineResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  quantity: {
    id: "quantity",
    field: "quantity",
    predicate: false,
    create: () => LineResourceFilterRules["quantity"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => LineResourceFilterRules["quantity"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => LineResourceFilterRules["quantity"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => LineResourceFilterRules["quantity"]["$lt"].create(),
      },
    ],
  },
  grossCents: {
    id: "grossCents",
    field: "grossCents",
    predicate: false,
    create: () => LineResourceFilterRules["grossCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => LineResourceFilterRules["grossCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => LineResourceFilterRules["grossCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => LineResourceFilterRules["grossCents"]["$lt"].create(),
      },
    ],
  },
  marginCents: {
    id: "marginCents",
    field: "marginCents",
    predicate: false,
    create: () => LineResourceFilterRules["marginCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => LineResourceFilterRules["marginCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => LineResourceFilterRules["marginCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => LineResourceFilterRules["marginCents"]["$lt"].create(),
      },
    ],
  },
  shortageUnits: {
    id: "shortageUnits",
    field: "shortageUnits",
    predicate: false,
    create: () => LineResourceFilterRules["shortageUnits"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => LineResourceFilterRules["shortageUnits"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => LineResourceFilterRules["shortageUnits"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => LineResourceFilterRules["shortageUnits"]["$lt"].create(),
      },
    ],
  },
  placedAt: {
    id: "placedAt",
    field: "placedAt",
    predicate: false,
    create: () => LineResourceFilterRules["placedAt"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => LineResourceFilterRules["placedAt"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => LineResourceFilterRules["placedAt"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => LineResourceFilterRules["placedAt"]["$lt"].create(),
      },
    ],
  },
  status: {
    id: "status",
    field: "status",
    predicate: false,
    create: () => LineResourceFilterRules["status"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => LineResourceFilterRules["status"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => LineResourceFilterRules["status"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () => LineResourceFilterRules["status"]["$startsWith"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_LineResource>]: FilterChoice<R_LineResource>;
};
export const LineResourceFilterEditors = defineFilterEditors<R_LineResource>({
  fields: Object.values(LineResourceChoices),
  combine: {
    and: (children) => ({ $and: children }),
    or: (children) => ({ $or: children }),
    not: (child) => ({ $not: child }),
  },
});
type R_OrderResource = (typeof contracts)["OrderResource"];
const OrderResourceRule = ruleFor<R_OrderResource>();
export const OrderResourceFilterRules = {
  id: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["id"]["$eq"],
      (value) => ({ id: { $eq: value } }),
    ),
  },
  number: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["number"]["$eq"],
      (value) => ({ number: { $eq: value } }),
    ),
    $in: OrderResourceRule(
      inputs.OrderResourceFilters["number"]["$in"],
      (value) => ({ number: { $in: value } }),
    ),
    $startsWith: OrderResourceRule(
      inputs.OrderResourceFilters["number"]["$startsWith"],
      (value) => ({ number: { $startsWith: value } }),
    ),
  },
  status: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["status"]["$eq"],
      (value) => ({ status: { $eq: value } }),
    ),
    $in: OrderResourceRule(
      inputs.OrderResourceFilters["status"]["$in"],
      (value) => ({ status: { $in: value } }),
    ),
    $startsWith: OrderResourceRule(
      inputs.OrderResourceFilters["status"]["$startsWith"],
      (value) => ({ status: { $startsWith: value } }),
    ),
  },
  region: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["region"]["$eq"],
      (value) => ({ region: { $eq: value } }),
    ),
    $in: OrderResourceRule(
      inputs.OrderResourceFilters["region"]["$in"],
      (value) => ({ region: { $in: value } }),
    ),
    $startsWith: OrderResourceRule(
      inputs.OrderResourceFilters["region"]["$startsWith"],
      (value) => ({ region: { $startsWith: value } }),
    ),
  },
  placedAt: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["placedAt"]["$eq"],
      (value) => ({ placedAt: { $eq: value } }),
    ),
    $gte: OrderResourceRule(
      inputs.OrderResourceFilters["placedAt"]["$gte"],
      (value) => ({ placedAt: { $gte: value } }),
    ),
    $lt: OrderResourceRule(
      inputs.OrderResourceFilters["placedAt"]["$lt"],
      (value) => ({ placedAt: { $lt: value } }),
    ),
  },
  totalCents: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["totalCents"]["$eq"],
      (value) => ({ totalCents: { $eq: value } }),
    ),
    $gte: OrderResourceRule(
      inputs.OrderResourceFilters["totalCents"]["$gte"],
      (value) => ({ totalCents: { $gte: value } }),
    ),
    $lt: OrderResourceRule(
      inputs.OrderResourceFilters["totalCents"]["$lt"],
      (value) => ({ totalCents: { $lt: value } }),
    ),
  },
  netCents: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["netCents"]["$eq"],
      (value) => ({ netCents: { $eq: value } }),
    ),
    $gte: OrderResourceRule(
      inputs.OrderResourceFilters["netCents"]["$gte"],
      (value) => ({ netCents: { $gte: value } }),
    ),
    $lt: OrderResourceRule(
      inputs.OrderResourceFilters["netCents"]["$lt"],
      (value) => ({ netCents: { $lt: value } }),
    ),
  },
  priority: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["priority"]["$eq"],
      (value) => ({ priority: { $eq: value } }),
    ),
    $gte: OrderResourceRule(
      inputs.OrderResourceFilters["priority"]["$gte"],
      (value) => ({ priority: { $gte: value } }),
    ),
    $lt: OrderResourceRule(
      inputs.OrderResourceFilters["priority"]["$lt"],
      (value) => ({ priority: { $lt: value } }),
    ),
  },
  shortageUnits: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["shortageUnits"]["$eq"],
      (value) => ({ shortageUnits: { $eq: value } }),
    ),
    $gte: OrderResourceRule(
      inputs.OrderResourceFilters["shortageUnits"]["$gte"],
      (value) => ({ shortageUnits: { $gte: value } }),
    ),
    $lt: OrderResourceRule(
      inputs.OrderResourceFilters["shortageUnits"]["$lt"],
      (value) => ({ shortageUnits: { $lt: value } }),
    ),
  },
  fulfillmentScore: {
    $eq: OrderResourceRule(
      inputs.OrderResourceFilters["fulfillmentScore"]["$eq"],
      (value) => ({ fulfillmentScore: { $eq: value } }),
    ),
    $gte: OrderResourceRule(
      inputs.OrderResourceFilters["fulfillmentScore"]["$gte"],
      (value) => ({ fulfillmentScore: { $gte: value } }),
    ),
    $lt: OrderResourceRule(
      inputs.OrderResourceFilters["fulfillmentScore"]["$lt"],
      (value) => ({ fulfillmentScore: { $lt: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_OrderResource>;
const OrderResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => OrderResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  number: {
    id: "number",
    field: "number",
    predicate: false,
    create: () => OrderResourceFilterRules["number"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["number"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => OrderResourceFilterRules["number"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          OrderResourceFilterRules["number"]["$startsWith"].create(),
      },
    ],
  },
  status: {
    id: "status",
    field: "status",
    predicate: false,
    create: () => OrderResourceFilterRules["status"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["status"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => OrderResourceFilterRules["status"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          OrderResourceFilterRules["status"]["$startsWith"].create(),
      },
    ],
  },
  region: {
    id: "region",
    field: "region",
    predicate: false,
    create: () => OrderResourceFilterRules["region"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["region"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => OrderResourceFilterRules["region"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          OrderResourceFilterRules["region"]["$startsWith"].create(),
      },
    ],
  },
  placedAt: {
    id: "placedAt",
    field: "placedAt",
    predicate: false,
    create: () => OrderResourceFilterRules["placedAt"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["placedAt"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => OrderResourceFilterRules["placedAt"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => OrderResourceFilterRules["placedAt"]["$lt"].create(),
      },
    ],
  },
  totalCents: {
    id: "totalCents",
    field: "totalCents",
    predicate: false,
    create: () => OrderResourceFilterRules["totalCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["totalCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => OrderResourceFilterRules["totalCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => OrderResourceFilterRules["totalCents"]["$lt"].create(),
      },
    ],
  },
  netCents: {
    id: "netCents",
    field: "netCents",
    predicate: false,
    create: () => OrderResourceFilterRules["netCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["netCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => OrderResourceFilterRules["netCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => OrderResourceFilterRules["netCents"]["$lt"].create(),
      },
    ],
  },
  priority: {
    id: "priority",
    field: "priority",
    predicate: false,
    create: () => OrderResourceFilterRules["priority"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["priority"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => OrderResourceFilterRules["priority"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => OrderResourceFilterRules["priority"]["$lt"].create(),
      },
    ],
  },
  shortageUnits: {
    id: "shortageUnits",
    field: "shortageUnits",
    predicate: false,
    create: () => OrderResourceFilterRules["shortageUnits"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => OrderResourceFilterRules["shortageUnits"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          OrderResourceFilterRules["shortageUnits"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => OrderResourceFilterRules["shortageUnits"]["$lt"].create(),
      },
    ],
  },
  fulfillmentScore: {
    id: "fulfillmentScore",
    field: "fulfillmentScore",
    predicate: false,
    create: () => OrderResourceFilterRules["fulfillmentScore"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          OrderResourceFilterRules["fulfillmentScore"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          OrderResourceFilterRules["fulfillmentScore"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          OrderResourceFilterRules["fulfillmentScore"]["$lt"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_OrderResource>]: FilterChoice<R_OrderResource>;
};
export const OrderResourceFilterEditors = defineFilterEditors<R_OrderResource>({
  fields: Object.values(OrderResourceChoices),
  combine: {
    and: (children) => ({ $and: children }),
    or: (children) => ({ $or: children }),
    not: (child) => ({ $not: child }),
  },
});
type R_TicketResource = (typeof contracts)["TicketResource"];
const TicketResourceRule = ruleFor<R_TicketResource>();
export const TicketResourceFilterRules = {
  id: {
    $eq: TicketResourceRule(
      inputs.TicketResourceFilters["id"]["$eq"],
      (value) => ({ id: { $eq: value } }),
    ),
  },
  subject: {
    $eq: TicketResourceRule(
      inputs.TicketResourceFilters["subject"]["$eq"],
      (value) => ({ subject: { $eq: value } }),
    ),
    $in: TicketResourceRule(
      inputs.TicketResourceFilters["subject"]["$in"],
      (value) => ({ subject: { $in: value } }),
    ),
    $startsWith: TicketResourceRule(
      inputs.TicketResourceFilters["subject"]["$startsWith"],
      (value) => ({ subject: { $startsWith: value } }),
    ),
  },
  status: {
    $eq: TicketResourceRule(
      inputs.TicketResourceFilters["status"]["$eq"],
      (value) => ({ status: { $eq: value } }),
    ),
    $in: TicketResourceRule(
      inputs.TicketResourceFilters["status"]["$in"],
      (value) => ({ status: { $in: value } }),
    ),
    $startsWith: TicketResourceRule(
      inputs.TicketResourceFilters["status"]["$startsWith"],
      (value) => ({ status: { $startsWith: value } }),
    ),
  },
  priority: {
    $eq: TicketResourceRule(
      inputs.TicketResourceFilters["priority"]["$eq"],
      (value) => ({ priority: { $eq: value } }),
    ),
    $gte: TicketResourceRule(
      inputs.TicketResourceFilters["priority"]["$gte"],
      (value) => ({ priority: { $gte: value } }),
    ),
    $lt: TicketResourceRule(
      inputs.TicketResourceFilters["priority"]["$lt"],
      (value) => ({ priority: { $lt: value } }),
    ),
  },
  openedAt: {
    $eq: TicketResourceRule(
      inputs.TicketResourceFilters["openedAt"]["$eq"],
      (value) => ({ openedAt: { $eq: value } }),
    ),
    $gte: TicketResourceRule(
      inputs.TicketResourceFilters["openedAt"]["$gte"],
      (value) => ({ openedAt: { $gte: value } }),
    ),
    $lt: TicketResourceRule(
      inputs.TicketResourceFilters["openedAt"]["$lt"],
      (value) => ({ openedAt: { $lt: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_TicketResource>;
const TicketResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => TicketResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => TicketResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  subject: {
    id: "subject",
    field: "subject",
    predicate: false,
    create: () => TicketResourceFilterRules["subject"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => TicketResourceFilterRules["subject"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => TicketResourceFilterRules["subject"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          TicketResourceFilterRules["subject"]["$startsWith"].create(),
      },
    ],
  },
  status: {
    id: "status",
    field: "status",
    predicate: false,
    create: () => TicketResourceFilterRules["status"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => TicketResourceFilterRules["status"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => TicketResourceFilterRules["status"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          TicketResourceFilterRules["status"]["$startsWith"].create(),
      },
    ],
  },
  priority: {
    id: "priority",
    field: "priority",
    predicate: false,
    create: () => TicketResourceFilterRules["priority"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => TicketResourceFilterRules["priority"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => TicketResourceFilterRules["priority"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => TicketResourceFilterRules["priority"]["$lt"].create(),
      },
    ],
  },
  openedAt: {
    id: "openedAt",
    field: "openedAt",
    predicate: false,
    create: () => TicketResourceFilterRules["openedAt"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => TicketResourceFilterRules["openedAt"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => TicketResourceFilterRules["openedAt"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => TicketResourceFilterRules["openedAt"]["$lt"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_TicketResource>]: FilterChoice<R_TicketResource>;
};
export const TicketResourceFilterEditors =
  defineFilterEditors<R_TicketResource>({
    fields: Object.values(TicketResourceChoices),
    combine: {
      and: (children) => ({ $and: children }),
      or: (children) => ({ $or: children }),
      not: (child) => ({ $not: child }),
    },
  });
type R_ShipmentResource = (typeof contracts)["ShipmentResource"];
const ShipmentResourceRule = ruleFor<R_ShipmentResource>();
export const ShipmentResourceFilterRules = {
  id: {
    $eq: ShipmentResourceRule(
      inputs.ShipmentResourceFilters["id"]["$eq"],
      (value) => ({ id: { $eq: value } }),
    ),
  },
  late: {
    $eq: ShipmentResourceRule(
      inputs.ShipmentResourceFilters["late"]["$eq"],
      (value) => ({ late: { $eq: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_ShipmentResource>;
const ShipmentResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => ShipmentResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ShipmentResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  late: {
    id: "late",
    field: "late",
    predicate: false,
    create: () => ShipmentResourceFilterRules["late"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ShipmentResourceFilterRules["late"]["$eq"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_ShipmentResource>]: FilterChoice<R_ShipmentResource>;
};
export const ShipmentResourceFilterEditors =
  defineFilterEditors<R_ShipmentResource>({
    fields: Object.values(ShipmentResourceChoices),
    combine: {
      and: (children) => ({ $and: children }),
      or: (children) => ({ $or: children }),
      not: (child) => ({ $not: child }),
    },
  });
type R_AccountResource = (typeof contracts)["AccountResource"];
const AccountResourceRule = ruleFor<R_AccountResource>();
export const AccountResourceFilterRules = {
  id: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["id"]["$eq"],
      (value) => ({ id: { $eq: value } }),
    ),
  },
  name: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["name"]["$eq"],
      (value) => ({ name: { $eq: value } }),
    ),
    $in: AccountResourceRule(
      inputs.AccountResourceFilters["name"]["$in"],
      (value) => ({ name: { $in: value } }),
    ),
    $startsWith: AccountResourceRule(
      inputs.AccountResourceFilters["name"]["$startsWith"],
      (value) => ({ name: { $startsWith: value } }),
    ),
  },
  tier: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["tier"]["$eq"],
      (value) => ({ tier: { $eq: value } }),
    ),
    $in: AccountResourceRule(
      inputs.AccountResourceFilters["tier"]["$in"],
      (value) => ({ tier: { $in: value } }),
    ),
    $startsWith: AccountResourceRule(
      inputs.AccountResourceFilters["tier"]["$startsWith"],
      (value) => ({ tier: { $startsWith: value } }),
    ),
  },
  region: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["region"]["$eq"],
      (value) => ({ region: { $eq: value } }),
    ),
    $in: AccountResourceRule(
      inputs.AccountResourceFilters["region"]["$in"],
      (value) => ({ region: { $in: value } }),
    ),
    $startsWith: AccountResourceRule(
      inputs.AccountResourceFilters["region"]["$startsWith"],
      (value) => ({ region: { $startsWith: value } }),
    ),
  },
  creditLimitCents: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["creditLimitCents"]["$eq"],
      (value) => ({ creditLimitCents: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["creditLimitCents"]["$gte"],
      (value) => ({ creditLimitCents: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["creditLimitCents"]["$lt"],
      (value) => ({ creditLimitCents: { $lt: value } }),
    ),
  },
  grossRevenueCents: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["grossRevenueCents"]["$eq"],
      (value) => ({ grossRevenueCents: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["grossRevenueCents"]["$gte"],
      (value) => ({ grossRevenueCents: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["grossRevenueCents"]["$lt"],
      (value) => ({ grossRevenueCents: { $lt: value } }),
    ),
  },
  netRevenueCents: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["netRevenueCents"]["$eq"],
      (value) => ({ netRevenueCents: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["netRevenueCents"]["$gte"],
      (value) => ({ netRevenueCents: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["netRevenueCents"]["$lt"],
      (value) => ({ netRevenueCents: { $lt: value } }),
    ),
  },
  costCents: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["costCents"]["$eq"],
      (value) => ({ costCents: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["costCents"]["$gte"],
      (value) => ({ costCents: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["costCents"]["$lt"],
      (value) => ({ costCents: { $lt: value } }),
    ),
  },
  revenueOrderCount: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["revenueOrderCount"]["$eq"],
      (value) => ({ revenueOrderCount: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["revenueOrderCount"]["$gte"],
      (value) => ({ revenueOrderCount: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["revenueOrderCount"]["$lt"],
      (value) => ({ revenueOrderCount: { $lt: value } }),
    ),
  },
  marginBps: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["marginBps"]["$eq"],
      (value) => ({ marginBps: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["marginBps"]["$gte"],
      (value) => ({ marginBps: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["marginBps"]["$lt"],
      (value) => ({ marginBps: { $lt: value } }),
    ),
  },
  openTicketCount: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["openTicketCount"]["$eq"],
      (value) => ({ openTicketCount: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["openTicketCount"]["$gte"],
      (value) => ({ openTicketCount: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["openTicketCount"]["$lt"],
      (value) => ({ openTicketCount: { $lt: value } }),
    ),
  },
  lateShipmentCount: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["lateShipmentCount"]["$eq"],
      (value) => ({ lateShipmentCount: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["lateShipmentCount"]["$gte"],
      (value) => ({ lateShipmentCount: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["lateShipmentCount"]["$lt"],
      (value) => ({ lateShipmentCount: { $lt: value } }),
    ),
  },
  riskScore: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["riskScore"]["$eq"],
      (value) => ({ riskScore: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["riskScore"]["$gte"],
      (value) => ({ riskScore: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["riskScore"]["$lt"],
      (value) => ({ riskScore: { $lt: value } }),
    ),
  },
  riskBand: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["riskBand"]["$eq"],
      (value) => ({ riskBand: { $eq: value } }),
    ),
    $in: AccountResourceRule(
      inputs.AccountResourceFilters["riskBand"]["$in"],
      (value) => ({ riskBand: { $in: value } }),
    ),
    $startsWith: AccountResourceRule(
      inputs.AccountResourceFilters["riskBand"]["$startsWith"],
      (value) => ({ riskBand: { $startsWith: value } }),
    ),
  },
  managerRevenueCents: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["managerRevenueCents"]["$eq"],
      (value) => ({ managerRevenueCents: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["managerRevenueCents"]["$gte"],
      (value) => ({ managerRevenueCents: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["managerRevenueCents"]["$lt"],
      (value) => ({ managerRevenueCents: { $lt: value } }),
    ),
  },
  managerConcentrationBps: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["managerConcentrationBps"]["$eq"],
      (value) => ({ managerConcentrationBps: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["managerConcentrationBps"]["$gte"],
      (value) => ({ managerConcentrationBps: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["managerConcentrationBps"]["$lt"],
      (value) => ({ managerConcentrationBps: { $lt: value } }),
    ),
  },
  portfolioShareBps: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["portfolioShareBps"]["$eq"],
      (value) => ({ portfolioShareBps: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["portfolioShareBps"]["$gte"],
      (value) => ({ portfolioShareBps: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["portfolioShareBps"]["$lt"],
      (value) => ({ portfolioShareBps: { $lt: value } }),
    ),
  },
  recentOrderCount: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderCount"]["$eq"],
      (value) => ({ recentOrderCount: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderCount"]["$gte"],
      (value) => ({ recentOrderCount: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderCount"]["$lt"],
      (value) => ({ recentOrderCount: { $lt: value } }),
    ),
  },
  recentOrderAverage: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderAverage"]["$eq"],
      (value) => ({ recentOrderAverage: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderAverage"]["$gte"],
      (value) => ({ recentOrderAverage: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderAverage"]["$lt"],
      (value) => ({ recentOrderAverage: { $lt: value } }),
    ),
  },
  recentOrderMin: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderMin"]["$eq"],
      (value) => ({ recentOrderMin: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderMin"]["$gte"],
      (value) => ({ recentOrderMin: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderMin"]["$lt"],
      (value) => ({ recentOrderMin: { $lt: value } }),
    ),
  },
  recentOrderMax: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderMax"]["$eq"],
      (value) => ({ recentOrderMax: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderMax"]["$gte"],
      (value) => ({ recentOrderMax: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["recentOrderMax"]["$lt"],
      (value) => ({ recentOrderMax: { $lt: value } }),
    ),
  },
  latestPaidOrderCents: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["latestPaidOrderCents"]["$eq"],
      (value) => ({ latestPaidOrderCents: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["latestPaidOrderCents"]["$gte"],
      (value) => ({ latestPaidOrderCents: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["latestPaidOrderCents"]["$lt"],
      (value) => ({ latestPaidOrderCents: { $lt: value } }),
    ),
  },
  orderVolatility: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["orderVolatility"]["$eq"],
      (value) => ({ orderVolatility: { $eq: value } }),
    ),
    $gte: AccountResourceRule(
      inputs.AccountResourceFilters["orderVolatility"]["$gte"],
      (value) => ({ orderVolatility: { $gte: value } }),
    ),
    $lt: AccountResourceRule(
      inputs.AccountResourceFilters["orderVolatility"]["$lt"],
      (value) => ({ orderVolatility: { $lt: value } }),
    ),
  },
  hasRecentEscalation: {
    $eq: AccountResourceRule(
      inputs.AccountResourceFilters["hasRecentEscalation"]["$eq"],
      (value) => ({ hasRecentEscalation: { $eq: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_AccountResource>;
const AccountResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => AccountResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  name: {
    id: "name",
    field: "name",
    predicate: false,
    create: () => AccountResourceFilterRules["name"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["name"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AccountResourceFilterRules["name"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          AccountResourceFilterRules["name"]["$startsWith"].create(),
      },
    ],
  },
  tier: {
    id: "tier",
    field: "tier",
    predicate: false,
    create: () => AccountResourceFilterRules["tier"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["tier"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AccountResourceFilterRules["tier"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          AccountResourceFilterRules["tier"]["$startsWith"].create(),
      },
    ],
  },
  region: {
    id: "region",
    field: "region",
    predicate: false,
    create: () => AccountResourceFilterRules["region"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["region"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AccountResourceFilterRules["region"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          AccountResourceFilterRules["region"]["$startsWith"].create(),
      },
    ],
  },
  creditLimitCents: {
    id: "creditLimitCents",
    field: "creditLimitCents",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["creditLimitCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["creditLimitCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["creditLimitCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["creditLimitCents"]["$lt"].create(),
      },
    ],
  },
  grossRevenueCents: {
    id: "grossRevenueCents",
    field: "grossRevenueCents",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["grossRevenueCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["grossRevenueCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["grossRevenueCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["grossRevenueCents"]["$lt"].create(),
      },
    ],
  },
  netRevenueCents: {
    id: "netRevenueCents",
    field: "netRevenueCents",
    predicate: false,
    create: () => AccountResourceFilterRules["netRevenueCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["netRevenueCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["netRevenueCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["netRevenueCents"]["$lt"].create(),
      },
    ],
  },
  costCents: {
    id: "costCents",
    field: "costCents",
    predicate: false,
    create: () => AccountResourceFilterRules["costCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["costCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => AccountResourceFilterRules["costCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => AccountResourceFilterRules["costCents"]["$lt"].create(),
      },
    ],
  },
  revenueOrderCount: {
    id: "revenueOrderCount",
    field: "revenueOrderCount",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["revenueOrderCount"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["revenueOrderCount"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["revenueOrderCount"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["revenueOrderCount"]["$lt"].create(),
      },
    ],
  },
  marginBps: {
    id: "marginBps",
    field: "marginBps",
    predicate: false,
    create: () => AccountResourceFilterRules["marginBps"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["marginBps"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => AccountResourceFilterRules["marginBps"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => AccountResourceFilterRules["marginBps"]["$lt"].create(),
      },
    ],
  },
  openTicketCount: {
    id: "openTicketCount",
    field: "openTicketCount",
    predicate: false,
    create: () => AccountResourceFilterRules["openTicketCount"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["openTicketCount"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["openTicketCount"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["openTicketCount"]["$lt"].create(),
      },
    ],
  },
  lateShipmentCount: {
    id: "lateShipmentCount",
    field: "lateShipmentCount",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["lateShipmentCount"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["lateShipmentCount"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["lateShipmentCount"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["lateShipmentCount"]["$lt"].create(),
      },
    ],
  },
  riskScore: {
    id: "riskScore",
    field: "riskScore",
    predicate: false,
    create: () => AccountResourceFilterRules["riskScore"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["riskScore"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => AccountResourceFilterRules["riskScore"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => AccountResourceFilterRules["riskScore"]["$lt"].create(),
      },
    ],
  },
  riskBand: {
    id: "riskBand",
    field: "riskBand",
    predicate: false,
    create: () => AccountResourceFilterRules["riskBand"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => AccountResourceFilterRules["riskBand"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => AccountResourceFilterRules["riskBand"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          AccountResourceFilterRules["riskBand"]["$startsWith"].create(),
      },
    ],
  },
  managerRevenueCents: {
    id: "managerRevenueCents",
    field: "managerRevenueCents",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["managerRevenueCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["managerRevenueCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["managerRevenueCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["managerRevenueCents"]["$lt"].create(),
      },
    ],
  },
  managerConcentrationBps: {
    id: "managerConcentrationBps",
    field: "managerConcentrationBps",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["managerConcentrationBps"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["managerConcentrationBps"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["managerConcentrationBps"][
            "$gte"
          ].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["managerConcentrationBps"]["$lt"].create(),
      },
    ],
  },
  portfolioShareBps: {
    id: "portfolioShareBps",
    field: "portfolioShareBps",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["portfolioShareBps"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["portfolioShareBps"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["portfolioShareBps"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["portfolioShareBps"]["$lt"].create(),
      },
    ],
  },
  recentOrderCount: {
    id: "recentOrderCount",
    field: "recentOrderCount",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["recentOrderCount"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["recentOrderCount"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["recentOrderCount"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["recentOrderCount"]["$lt"].create(),
      },
    ],
  },
  recentOrderAverage: {
    id: "recentOrderAverage",
    field: "recentOrderAverage",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["recentOrderAverage"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["recentOrderAverage"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["recentOrderAverage"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["recentOrderAverage"]["$lt"].create(),
      },
    ],
  },
  recentOrderMin: {
    id: "recentOrderMin",
    field: "recentOrderMin",
    predicate: false,
    create: () => AccountResourceFilterRules["recentOrderMin"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["recentOrderMin"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["recentOrderMin"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["recentOrderMin"]["$lt"].create(),
      },
    ],
  },
  recentOrderMax: {
    id: "recentOrderMax",
    field: "recentOrderMax",
    predicate: false,
    create: () => AccountResourceFilterRules["recentOrderMax"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["recentOrderMax"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["recentOrderMax"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["recentOrderMax"]["$lt"].create(),
      },
    ],
  },
  latestPaidOrderCents: {
    id: "latestPaidOrderCents",
    field: "latestPaidOrderCents",
    predicate: false,
    create: () =>
      AccountResourceFilterRules["latestPaidOrderCents"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["latestPaidOrderCents"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["latestPaidOrderCents"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["latestPaidOrderCents"]["$lt"].create(),
      },
    ],
  },
  orderVolatility: {
    id: "orderVolatility",
    field: "orderVolatility",
    predicate: false,
    create: () => AccountResourceFilterRules["orderVolatility"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["orderVolatility"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          AccountResourceFilterRules["orderVolatility"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          AccountResourceFilterRules["orderVolatility"]["$lt"].create(),
      },
    ],
  },
  hasRecentEscalation: {
    id: "hasRecentEscalation",
    field: "hasRecentEscalation",
    predicate: true,
    create: () =>
      AccountResourceFilterRules["hasRecentEscalation"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          AccountResourceFilterRules["hasRecentEscalation"]["$eq"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_AccountResource>]: FilterChoice<R_AccountResource>;
};
export const AccountResourceFilterEditors =
  defineFilterEditors<R_AccountResource>({
    fields: Object.values(AccountResourceChoices),
    combine: {
      and: (children) => ({ $and: children }),
      or: (children) => ({ $or: children }),
      not: (child) => ({ $not: child }),
    },
  });
type R_ProductResource = (typeof contracts)["ProductResource"];
const ProductResourceRule = ruleFor<R_ProductResource>();
export const ProductResourceFilterRules = {
  id: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["id"]["$eq"],
      (value) => ({ id: { $eq: value } }),
    ),
  },
  name: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["name"]["$eq"],
      (value) => ({ name: { $eq: value } }),
    ),
    $in: ProductResourceRule(
      inputs.ProductResourceFilters["name"]["$in"],
      (value) => ({ name: { $in: value } }),
    ),
    $startsWith: ProductResourceRule(
      inputs.ProductResourceFilters["name"]["$startsWith"],
      (value) => ({ name: { $startsWith: value } }),
    ),
  },
  sku: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["sku"]["$eq"],
      (value) => ({ sku: { $eq: value } }),
    ),
    $in: ProductResourceRule(
      inputs.ProductResourceFilters["sku"]["$in"],
      (value) => ({ sku: { $in: value } }),
    ),
    $startsWith: ProductResourceRule(
      inputs.ProductResourceFilters["sku"]["$startsWith"],
      (value) => ({ sku: { $startsWith: value } }),
    ),
  },
  category: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["category"]["$eq"],
      (value) => ({ category: { $eq: value } }),
    ),
    $in: ProductResourceRule(
      inputs.ProductResourceFilters["category"]["$in"],
      (value) => ({ category: { $in: value } }),
    ),
    $startsWith: ProductResourceRule(
      inputs.ProductResourceFilters["category"]["$startsWith"],
      (value) => ({ category: { $startsWith: value } }),
    ),
  },
  active: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["active"]["$eq"],
      (value) => ({ active: { $eq: value } }),
    ),
  },
  available: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["available"]["$eq"],
      (value) => ({ available: { $eq: value } }),
    ),
    $gte: ProductResourceRule(
      inputs.ProductResourceFilters["available"]["$gte"],
      (value) => ({ available: { $gte: value } }),
    ),
    $lt: ProductResourceRule(
      inputs.ProductResourceFilters["available"]["$lt"],
      (value) => ({ available: { $lt: value } }),
    ),
  },
  unitsSold: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["unitsSold"]["$eq"],
      (value) => ({ unitsSold: { $eq: value } }),
    ),
    $gte: ProductResourceRule(
      inputs.ProductResourceFilters["unitsSold"]["$gte"],
      (value) => ({ unitsSold: { $gte: value } }),
    ),
    $lt: ProductResourceRule(
      inputs.ProductResourceFilters["unitsSold"]["$lt"],
      (value) => ({ unitsSold: { $lt: value } }),
    ),
  },
  warehouseCount: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["warehouseCount"]["$eq"],
      (value) => ({ warehouseCount: { $eq: value } }),
    ),
    $gte: ProductResourceRule(
      inputs.ProductResourceFilters["warehouseCount"]["$gte"],
      (value) => ({ warehouseCount: { $gte: value } }),
    ),
    $lt: ProductResourceRule(
      inputs.ProductResourceFilters["warehouseCount"]["$lt"],
      (value) => ({ warehouseCount: { $lt: value } }),
    ),
  },
  daysCover: {
    $eq: ProductResourceRule(
      inputs.ProductResourceFilters["daysCover"]["$eq"],
      (value) => ({ daysCover: { $eq: value } }),
    ),
    $gte: ProductResourceRule(
      inputs.ProductResourceFilters["daysCover"]["$gte"],
      (value) => ({ daysCover: { $gte: value } }),
    ),
    $lt: ProductResourceRule(
      inputs.ProductResourceFilters["daysCover"]["$lt"],
      (value) => ({ daysCover: { $lt: value } }),
    ),
  },
} satisfies FilterRuleFactories<R_ProductResource>;
const ProductResourceChoices = {
  id: {
    id: "id",
    field: "id",
    predicate: false,
    create: () => ProductResourceFilterRules["id"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["id"]["$eq"].create(),
      },
    ],
  },
  name: {
    id: "name",
    field: "name",
    predicate: false,
    create: () => ProductResourceFilterRules["name"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["name"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => ProductResourceFilterRules["name"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          ProductResourceFilterRules["name"]["$startsWith"].create(),
      },
    ],
  },
  sku: {
    id: "sku",
    field: "sku",
    predicate: false,
    create: () => ProductResourceFilterRules["sku"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["sku"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => ProductResourceFilterRules["sku"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () => ProductResourceFilterRules["sku"]["$startsWith"].create(),
      },
    ],
  },
  category: {
    id: "category",
    field: "category",
    predicate: false,
    create: () => ProductResourceFilterRules["category"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["category"]["$eq"].create(),
      },
      {
        id: "$in",
        create: () => ProductResourceFilterRules["category"]["$in"].create(),
      },
      {
        id: "$startsWith",
        create: () =>
          ProductResourceFilterRules["category"]["$startsWith"].create(),
      },
    ],
  },
  active: {
    id: "active",
    field: "active",
    predicate: false,
    create: () => ProductResourceFilterRules["active"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["active"]["$eq"].create(),
      },
    ],
  },
  available: {
    id: "available",
    field: "available",
    predicate: false,
    create: () => ProductResourceFilterRules["available"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["available"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => ProductResourceFilterRules["available"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => ProductResourceFilterRules["available"]["$lt"].create(),
      },
    ],
  },
  unitsSold: {
    id: "unitsSold",
    field: "unitsSold",
    predicate: false,
    create: () => ProductResourceFilterRules["unitsSold"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["unitsSold"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => ProductResourceFilterRules["unitsSold"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => ProductResourceFilterRules["unitsSold"]["$lt"].create(),
      },
    ],
  },
  warehouseCount: {
    id: "warehouseCount",
    field: "warehouseCount",
    predicate: false,
    create: () => ProductResourceFilterRules["warehouseCount"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () =>
          ProductResourceFilterRules["warehouseCount"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () =>
          ProductResourceFilterRules["warehouseCount"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () =>
          ProductResourceFilterRules["warehouseCount"]["$lt"].create(),
      },
    ],
  },
  daysCover: {
    id: "daysCover",
    field: "daysCover",
    predicate: false,
    create: () => ProductResourceFilterRules["daysCover"]["$eq"].create(),
    operators: [
      {
        id: "$eq",
        create: () => ProductResourceFilterRules["daysCover"]["$eq"].create(),
      },
      {
        id: "$gte",
        create: () => ProductResourceFilterRules["daysCover"]["$gte"].create(),
      },
      {
        id: "$lt",
        create: () => ProductResourceFilterRules["daysCover"]["$lt"].create(),
      },
    ],
  },
} satisfies {
  [K in keyof FilterRuleFactories<R_ProductResource>]: FilterChoice<R_ProductResource>;
};
export const ProductResourceFilterEditors =
  defineFilterEditors<R_ProductResource>({
    fields: Object.values(ProductResourceChoices),
    combine: {
      and: (children) => ({ $and: children }),
      or: (children) => ({ $or: children }),
      not: (child) => ({ $not: child }),
    },
  });
