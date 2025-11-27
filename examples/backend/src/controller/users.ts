import { generateExecutor } from "@n/adira.backend.ts";
import User, { IUser } from "../models/User";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";

const getUsers = generateExecutor<"GET", IUser>("GET", User);
const createUser = generateExecutor<"POST", IUser>("POST", User);
const updateUser = generateExecutor<"PATCH", IUser>("PATCH", User);
const deleteUser = generateExecutor<"DELETE", IUser>("DELETE", User);

export type GetUsersFn = typeof getUsers;
export type CreateUserFn = typeof createUser;
export type UpdateUserFn = typeof updateUser;
export type DeleteUserFn = typeof deleteUser;

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

export const createUserHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<CreateUserFn>>,
  res: Response<Backend.InferHandlerResponse<CreateUserFn, {}> | ErrorResponse>,
) => {
  try {
    const user = await createUser(req.query, req.body);
    res.send({ executor: user });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside createUserHandler ${String(err)}`,
    });
  }
};

export const updateUserHandler = async (
  req: Request<
    { id: string },
    any,
    any,
    Backend.InferHandlerParams<UpdateUserFn>
  >,
  res: Response<Backend.InferHandlerResponse<UpdateUserFn, {}> | ErrorResponse>,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new Error("User id is required in params");
    }
    const user = await updateUser(id, req.query, req.body, {
      createNewRecord: true,
    });
    res.send({ executor: user });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside updateUserHandler ${String(err)}`,
    });
  }
};

export const deleteUserHandler = async (
  req: Request<
    { id: string },
    any,
    any,
    Backend.InferHandlerParams<DeleteUserFn>
  >,
  res: Response<Backend.InferHandlerResponse<DeleteUserFn, {}> | ErrorResponse>,
) => {
  try {
    const user = await deleteUser(req.params.id, req.query, {
      softDelete: async () => {
        await User.updateOne(
          { _id: req.params.id },
          { $set: { deletedAt: new Date() } },
        );
      },
    });
    res.send({ executor: user });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside deleteUserHandler ${String(err)}`,
    });
  }
};
