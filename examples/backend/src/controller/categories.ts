import { Backend, generateExecutor } from "@n/adira.backend.ts";
import Category, { ICategory } from "../models/Category";
import {
  AssertValidReplacements,
  IsObjectId,
  PopulatableKeys,
} from "@n/adira.core.ts";
import { Request, Response } from "express";
import { ErrorResponse } from "../types";
import mongoose from "mongoose";

type FullCategory = AssertValidReplacements<ICategory, {}>;

const getCategories = generateExecutor<"GET", ICategory, FullCategory>(
  "GET",
  Category,
);
const createCategory = generateExecutor<"POST", ICategory, FullCategory>(
  "POST",
  Category,
);
const updateCategory = generateExecutor<"PATCH", ICategory, FullCategory>(
  "PATCH",
  Category,
);
const deleteCategory = generateExecutor<"DELETE", ICategory, FullCategory>(
  "DELETE",
  Category,
);

export type GetCategoriesFn = typeof getCategories;
export type CreateCategoryFn = typeof createCategory;
export type UpdateCategoryFn = typeof updateCategory;
export type DeleteCategoryFn = typeof deleteCategory;

export const getCategoriesHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<GetCategoriesFn>>,
  res: Response<
    Backend.InferHandlerResponse<GetCategoriesFn, {}> | ErrorResponse
  >,
) => {
  try {
    const categories = await getCategories(req.query);
    res.send({ executor: categories });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside getCategoriesHandler ${String(err)}`,
    });
  }
};

export const createCategoryHandler = async (
  req: Request<any, any, any, Backend.InferHandlerParams<CreateCategoryFn>>,
  res: Response<
    Backend.InferHandlerResponse<CreateCategoryFn, {}> | ErrorResponse
  >,
) => {
  try {
    const category = await createCategory(req.query, req.body);
    res.send({ executor: category });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside createCategoryHandler ${String(err)}`,
    });
  }
};

export const updateCategoryHandler = async (
  req: Request<
    { id: string },
    any,
    any,
    Backend.InferHandlerParams<UpdateCategoryFn>
  >,
  res: Response<
    Backend.InferHandlerResponse<UpdateCategoryFn, {}> | ErrorResponse
  >,
) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new Error("Category id is required in params");
    }
    const category = await updateCategory(id, req.query, req.body, {
      createNewRecord: true,
    });
    res.send({ executor: category });
  } catch (err) {
    res.send({
      error: true,
      message: `Something crashed inside updateCategoryHandler ${String(err)}`,
    });
  }
};

// export const deleteCategoryHandler = async (
//   req: Request<any, any, Backend.InferHandlerParams<DeleteCategoryFn>>,
//   res: Response<
//     Backend.InferHandlerResponse<DeleteCategoryFn, {}> | ErrorResponse
//   >,
// ) => {
//   try {
//     const category = await deleteCategory(req.body);
//     res.send({ executor: category });
//   } catch (err) {
//     res.send({
//       error: true,
//       message: `Something crashed inside deleteCategoryHandler ${String(err)}`,
//     });
//   }
// };
