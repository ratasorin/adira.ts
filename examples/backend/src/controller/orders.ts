import { Backend, generateExecutor } from "@n/adira.backend.ts";
import Order, { IOrder } from "../models/Order";
import { ApplyReplacements } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";
import mongoose from "mongoose";

type FullOrder = ApplyReplacements<IOrder, {}>;
const getOrders = generateExecutor<"GET", IOrder, FullOrder>("GET", Order);
const createOrder = generateExecutor<"POST", IOrder, FullOrder>("POST", Order);
const updateOrder = generateExecutor<"PUT", IOrder, FullOrder>("PUT", Order);
const deleteOrder = generateExecutor<"DELETE", IOrder, FullOrder>("DELETE", Order);

export type GetOrdersFn = typeof getOrders;
export type CreateOrderFn = typeof createOrder;
export type UpdateOrderFn = typeof updateOrder;
export type DeleteOrderFn = typeof deleteOrder;

export const getOrdersHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetOrdersFn>>,
  res: Response<Backend.InferHandlerResponse<GetOrdersFn, {}> | ErrorResponse>,
) => {
  try {
    const orders = await getOrders(req.query);
    res.send({ executor: orders });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside getOrdersHandler ${String(err)}`,
    });
  }
};

export const createOrderHandler = async (
  req: Request<any, any, Backend.InferHandlerParams<CreateOrderFn>>,
  res: Response<Backend.InferHandlerResponse<CreateOrderFn, {}> | ErrorResponse>,
) => {
  try {
    const order = await createOrder(req.body);
    res.send({ executor: order });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside createOrderHandler ${String(err)}`,
    });
  }
};

export const updateOrderHandler = async (
  req: Request<any, any, Backend.InferHandlerParams<UpdateOrderFn>>,
  res: Response<Backend.InferHandlerResponse<UpdateOrderFn, {}> | ErrorResponse>,
) => {
  try {
    const order = await updateOrder(req.body);
    res.send({ executor: order });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside updateOrderHandler ${String(err)}`,
    });
  }
};

export const deleteOrderHandler = async (
  req: Request<any, any, Backend.InferHandlerParams<DeleteOrderFn>>,
  res: Response<Backend.InferHandlerResponse<DeleteOrderFn, {}> | ErrorResponse>,
) => {
  try {
    const order = await deleteOrder(req.body);
    res.send({ executor: order });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside deleteOrderHandler ${String(err)}`,
    });
  }
};