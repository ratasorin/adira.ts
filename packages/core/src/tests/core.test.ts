import mongoose from "mongoose";
import {
  BuildResponseBody,
  ExtractResponseBodyQUERY,
  ExtractSelect,
  FilterDefinition,
  Leafs,
  NestedSelection,
  ObjectIdLike,
  PopulatableKeys,
  PopulateSchema,
  RefTo,
  SelectableFieldsAfterJoin,
  SortByDefinition,
} from "..";
import { ExtractResBody } from "../helpers/frontend";
import { ExecuteGET } from "../helpers/backend";

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

interface Referal {
  _id: ObjectIdLike;
  code: string;
  discount: number;
}

interface User {
  _id: ObjectIdLike;
  name: string;
  email: string;
  age: number;
  company: ObjectIdLike & RefTo<Company>;
  friends: { friend: ObjectIdLike & RefTo<Friend>; since: number }[];
  phoneNumbers: number[];
  referals: ObjectIdLike & RefTo<Referal>[];
  createdAt: Date;
  updatedAt: Date;
}

interface Friend {
  _id: ObjectIdLike;
  baseUser: ObjectIdLike & RefTo<User>;
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

type SelectableFields = SelectableFieldsAfterJoin<
  PopulatedUser,
  User,
  ["friends.friend", "company"]
>;

type SelectableLeafs = Leafs<SelectableFields>;

type Select = ExtractSelect<PopulatedUser, User, ["friends.friend"]>;

type FilterUser = FilterDefinition<PopulatedUser>;
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

type SortBy = SortByDefinition<PopulatedUser>;
const sort: SortBy = {
  "friends.friend.baseUser": 1,
};

type TestExtractResponse = ExtractResponseBodyQUERY<
  PopulatedUser,
  User,
  ["friends.friend"],
  ["name", "email", "age", "friends.friend", "company"],
  [{ target: "friends.friend"; operation: "$count"; as: "allFriends" }],
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

type ExtractedResponseBody = ExtractResBody<Endpoints, "GET", [], []>;
