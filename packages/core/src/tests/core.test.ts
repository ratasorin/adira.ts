import mongoose from "mongoose";
import {
  QueryResponse,
  ExtractSelect,
  WhereDefinition,
  Leafs,
  SchemaAfterJoin,
  NestedSelection,
  PopulatableKeys,
  PopulateSchema,
  RefTo,
  SelectableFieldsAfterJoin,
  SortByDefinition,
  ExecutorQueryResponse,
  ExtractNewFieldsFromAggregates,
} from "..";
import { ExtractResBody } from "../helpers/frontend";
import { ExecuteGET } from "../helpers/backend";
import { ICategory } from "./models/Category";

interface Company {
  _id: string;
  name: string;
  industry: string;
  founded: number;
  address: {
    city: string;
    country: string;
  };
}

interface Referal {
  _id: string;
  code: string;
  discount: number;
}

interface User {
  _id: string;
  name: string;
  email: string;
  age: number;
  company: string & RefTo<Company>;
  friends: { friend: string & RefTo<Friend>; since: number }[];
  phoneNumbers: number[];
  referals: string & RefTo<Referal>[];
  createdAt: Date;
  updatedAt: Date;
}

interface Friend {
  _id: string;
  baseUser: string & RefTo<User>;
  profile: {
    avatar: string;
    size: string;
  };
}

type PopulatedUser = PopulateSchema<User>;

const selection = [
  "company.address.city",
  "company.address.country",
  "friends.friend.profile",
  "friends.since",
  "age",
] satisfies Leafs<PopulatedUser>[];

type NestedUserSelection = NestedSelection<PopulatedUser, typeof selection>;

const userSelection: NestedUserSelection = {
  age: 10,
  company: null,
  friends: [
    {
      friend: {
        profile: {
          avatar: "",
          size: "",
        },
      },
      since: 2010,
    },
  ],
};

type SelectableFields = SelectableFieldsAfterJoin<User, ["friends.friend"]>;
type UserWithCompany = SchemaAfterJoin<User, "company">;

type SelectableLeafs = Leafs<SelectableFields>;

type Select = ExtractSelect<User, ["friends.friend"]>;

type FilterUser = WhereDefinition<UserWithCompany>;
const filter: FilterUser = {
  $or: [
    {
      $and: [
        {
          friends: {},
          "company.name": { $regex: /netex/i },
        },
      ],
    },
  ],
};

type SortBy = SortByDefinition<Leafs<PopulatedUser>>;
const sort: SortBy = {
  "friends.friend.baseUser": 1,
};

type NewFields = ExtractNewFieldsFromAggregates<
  [
    {
      readonly on: "updatedAt";
      readonly fn: "$sum";
      readonly as: "totalUpdated";
    },
    {
      readonly on: "createdAt";
      readonly fn: "$sum";
      readonly as: "totalCreated";
    },
  ]
>;
