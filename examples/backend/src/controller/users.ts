import { Backend, generateExecutor } from "@n/adira.backend.ts";
import User, { IUser } from "../models/User";
import { ApplyReplacements } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";
import mongoose from "mongoose";

type FullUser = ApplyReplacements<IUser, {}>;
const getUsers = generateExecutor<"GET", IUser, FullUser>("GET", User);

export type GetUsersFn = typeof getUsers;

export const getUsersHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetUsersFn>>,
  res: Response<Backend.InferHandlerResponse<GetUsersFn, {}> | ErrorResponse>,
) => {
  try {
    const users = await getUsers(req.query);
    res.send({ executor: users });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside getUsersHandler ${String(err)}`,
    });
  }
};
