import { generateExecutor } from "@n/adira.backend.ts";
import Product, { IProduct } from "../models/Product";
import { Backend } from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";

const getProducts = generateExecutor<"GET", IProduct>("GET", Product);
const createProduct = generateExecutor<"POST", IProduct>("POST", Product);
const updateProduct = generateExecutor<"PATCH", IProduct>("PATCH", Product);
const deleteProduct = generateExecutor<"DELETE", IProduct>("DELETE", Product);

export type GetProductsFn = typeof getProducts;
export type CreateProductFn = typeof createProduct;
export type UpdateProductFn = typeof updateProduct;
export type DeleteProductFn = typeof deleteProduct;

export const getProductsHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetProductsFn>>,
  res: Response<
    Backend.InferHandlerResponse<GetProductsFn, {}> | ErrorResponse
  >,
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
  req: Request<any, any, any, Backend.InferHandlerParams<CreateProductFn>>,
  res: Response<
    Backend.InferHandlerResponse<CreateProductFn, {}> | ErrorResponse
  >,
) => {
  try {
    const product = await createProduct(req.query, req.body);
    res.send({ executor: product });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside createProductHandler ${String(err)}`,
    });
  }
};

export const updateProductHandler = async (
  req: Request<
    { id: string },
    any,
    any,
    Backend.InferHandlerParams<UpdateProductFn>
  >,
  res: Response<
    Backend.InferHandlerResponse<UpdateProductFn, {}> | ErrorResponse
  >,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new Error("Product id is required in params");
    }
    const product = await updateProduct(id, req.query, req.body, {
      createNewRecord: true,
    });
    res.send({ executor: product });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside updateProductHandler ${String(err)}`,
    });
  }
};

export const deleteProductHandler = async (
  req: Request<
    { id: string },
    any,
    any,
    Backend.InferHandlerParams<DeleteProductFn>
  >,
  res: Response<
    Backend.InferHandlerResponse<DeleteProductFn, {}> | ErrorResponse
  >,
) => {
  try {
    const product = await deleteProduct(req.params.id, req.query, {
      softDelete: async () => {
        await Product.updateOne(
          { _id: req.params.id },
          { $set: { deletedAt: new Date() } },
        );
      },
    });
    res.send({ executor: product });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside deleteProductHandler ${String(err)}`,
    });
  }
};