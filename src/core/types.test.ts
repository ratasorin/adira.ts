import mongoose from "mongoose";
import {
  BuildResponseBody,
  ExtractResponseBodyArray,
  ExtractResponseBodySingle,
  ExtractSelect,
  Filter,
  InferResponseBody,
  Leafs,
  NestedSelection,
  ObjectIdLike,
  PopulatedSchema,
  SelectableFieldsAfterJoin,
  SortSpec,
} from "./types";

declare module "mongoose" {
  namespace Types {
    interface ObjectId extends ObjectIdLike {}
  }
}

interface Company {
  _id: ObjectIdLike;
  name: string;
  industry: string;
  founded: number;
  address: {
    city: string;
    country: string;
  };
}

interface User {
  _id: ObjectIdLike;
  name: string;
  email: string;
  age: number;
  company: ObjectIdLike;
  friends: { friend: ObjectIdLike; since: number }[];
  phoneNumbers: number[];
  referals: ObjectIdLike[];
  createdAt: Date;
  updatedAt: Date;
}

interface Friend {
  _id: ObjectIdLike;
  baseUser: ObjectIdLike;
  profile: {
    avatar: string;
    size: string;
  };
}

type PopulatedUser = PopulatedSchema<
  User,
  { company: Company; "friends.friend": Friend }
>;

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

type SelectableFields = SelectableFieldsAfterJoin<
  PopulatedUser,
  User,
  ["friends.friend", "company"]
>;

type SelectableLeafs = Leafs<SelectableFields>;

type Select = ExtractSelect<PopulatedUser, User, ["friends.friend"]>;

type FilterUser = Filter<PopulatedUser>;
const filter: FilterUser = {
  $or: [
    {
      $and: [
        {
          friends: {
            $elemMatch: {
              "friend.profile.avatar": {
                $eq: "",
              },
            },
          },
          "company.name": { $regex: /netex/i },
        },
      ],
    },
  ],
};

type SortBy = SortSpec<PopulatedUser>;
const sort: SortBy = {
  "friends.friend.baseUser": 1,
};

type TestExtractResponse = ExtractResponseBodyArray<
  PopulatedUser,
  User,
  ["friends.friend"],
  ["name", "email", "age", "friends.friend"],
  [{ applyOnField: "age"; op: "$sum"; alias: "ABC" }],
  { hello: "world" }
>;

type SuccessReturn = BuildResponseBody<PopulatedUser, User, [], []>;
type EndpointDefReturn = SuccessReturn | Error | { hello: "world" };

type S = Extract<
  EndpointDefReturn,
  { __full?: any; __base?: any; __extra?: any; __array?: any }
>;
const s: S = {};

type EndpointDef = () => {
  ResponseBody?: EndpointDefReturn;
};

type Endpoints = {
  GET: EndpointDef;
};

type ExtractedResponseBody = InferResponseBody<Endpoints, "GET", [], []>;
const extracted: ExtractedResponseBody = {};
