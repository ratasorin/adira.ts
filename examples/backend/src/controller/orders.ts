import { generateExecutor } from "@n/adira.backend.ts";
import Order, { IOrder } from "../models/Order";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";

const getOrders = generateExecutor<"GET", IOrder>("GET", Order);
const createOrder = generateExecutor<"POST", IOrder>("POST", Order);
const updateOrder = generateExecutor<"PATCH", IOrder>("PATCH", Order);
const deleteOrder = generateExecutor<"DELETE", IOrder>("DELETE", Order);

export type GetOrdersFn = typeof getOrders;
export type CreateOrderFn = typeof createOrder;
export type UpdateOrderFn = typeof updateOrder;
export type DeleteOrderFn = typeof deleteOrder;

export const getOrdersHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetOrdersFn>>,
  res: Response<
    Backend.InferHandlerResponse<GetOrdersFn, {}> | ErrorResponse
  >,
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
  req: Request<any, any, any, Backend.InferHandlerParams<CreateOrderFn>>,
  res: Response<
    Backend.InferHandlerResponse<CreateOrderFn, {}> | ErrorResponse
  >,
) => {
  try {
    const order = await createOrder(req.query, req.body);
    res.send({ executor: order });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside createOrderHandler ${String(err)}`,
    });
  }
};

export const updateOrderHandler = async (
  req: Request<
    { id: string },
    any,
    any,
    Backend.InferHandlerParams<UpdateOrderFn>
  >,
  res: Response<
    Backend.InferHandlerResponse<UpdateOrderFn, {}> | ErrorResponse
  >,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new Error("Order id is required in params");
    }
    const order = await updateOrder(id, req.query, req.body, {
      createNewRecord: true,
    });
    res.send({ executor: order });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside updateOrderHandler ${String(err)}`,
    });
  }
};

export const deleteOrderHandler = async (
  req: Request<
    { id: string },
    any,
    any,
    Backend.InferHandlerParams<DeleteOrderFn>
  >,
  res: Response<
    Backend.InferHandlerResponse<DeleteOrderFn, {}> | ErrorResponse
  >,
) => {
  try {
    const order = await deleteOrder(req.params.id, req.query, {
      softDelete: async () => {
        await Order.updateOne(
          { _id: req.params.id },
          { $set: { deletedAt: new Date() } },
        );
      },
    });
    res.send({ executor: order });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside deleteOrderHandler ${String(err)}`,
    });
  }
};