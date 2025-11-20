import { Backend, generateExecutor } from "@n/adira.backend.ts";
import Product, { IProduct } from "../models/Product";
import { ApplyReplacements } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";
import mongoose from "mongoose";

type FullProduct = ApplyReplacements<IProduct, {}>;
const getProducts = generateExecutor<"GET", IProduct, FullProduct>("GET", Product);
const createProduct = generateExecutor<"POST", IProduct, FullProduct>("POST", Product);
const updateProduct = generateExecutor<"PUT", IProduct, FullProduct>("PUT", Product);
const deleteProduct = generateExecutor<"DELETE", IProduct, FullProduct>("DELETE", Product);

export type GetProductsFn = typeof getProducts;
export type CreateProductFn = typeof createProduct;
export type UpdateProductFn = typeof updateProduct;
export type DeleteProductFn = typeof deleteProduct;

export const getProductsHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetProductsFn>>,
  res: Response<Backend.InferHandlerResponse<GetProductsFn, {}> | ErrorResponse>,
) => {
  try {
    const products = await getProducts(req.query);
    res.send({ executor: products });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside getProductsHandler ${String(err)}`,
    });
  }
};

export const createProductHandler = async (
  req: Request<any, any, Backend.InferHandlerParams<CreateProductFn>>,
  res: Response<Backend.InferHandlerResponse<CreateProductFn, {}> | ErrorResponse>,
) => {
  try {
    const product = await createProduct(req.body);
    res.send({ executor: product });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside createProductHandler ${String(err)}`,
    });
  }
};

export const updateProductHandler = async (
  req: Request<any, any, Backend.InferHandlerParams<UpdateProductFn>>,
  res: Response<Backend.InferHandlerResponse<UpdateProductFn, {}> | ErrorResponse>,
) => {
  try {
    const product = await updateProduct(req.body);
    res.send({ executor: product });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside updateProductHandler ${String(err)}`,
    });
  }
};

export const deleteProductHandler = async (
  req: Request<any, any, Backend.InferHandlerParams<DeleteProductFn>>,
  res: Response<Backend.InferHandlerResponse<DeleteProductFn, {}> | ErrorResponse>,
) => {
  try {
    const product = await deleteProduct(req.body);
    res.send({ executor: product });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside deleteProductHandler ${String(err)}`,
    });
  }
};