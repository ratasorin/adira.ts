import {
  generateRouteHandler,
  GetAggregation,
  GetInclude,
  GetObjectAfterJoin,
  GetParams,
  GetResponseBody,
  GetSelect,
} from "@n/adira.backend.ts";
import User, { IUser } from "../models/User";
import { ApplyReplacements } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";

type FullUser = ApplyReplacements<IUser, {}>;
const getUsers = generateRouteHandler<"GET", IUser, FullUser>("GET", User);

export type GetUsersFn = typeof getUsers;

export const getUsersHandler = async <
  Include extends GetInclude<GetUsersFn>,
  Select extends GetSelect<GetUsersFn, Include>,
  Aggregations extends GetAggregation<GetUsersFn>,
  ObjectAfterJoin extends GetObjectAfterJoin<GetUsersFn, Include>,
>(
  req: Request<
    any,
    any,
    any,
    GetParams<Include, Select, Aggregations, ObjectAfterJoin>
  >,
  res: Response<
    | ErrorResponse
    | GetResponseBody<GetUsersFn, Include, Select, Aggregations, {}>
  >,
) => {
  try {
    const users = await getUsers(req.query);
    res.send({ base: users });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside getUsersHandler ${String(err)}`,
    });
  }
};
