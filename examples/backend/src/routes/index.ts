import express from "express";
import {
  createUserHandler,
  deleteUserHandler,
  getUsersHandler,
  updateUserHandler,
} from "../controller/users";
import {
  getCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
} from "../controller/categories";
import {
  getOrdersHandler,
  createOrderHandler,
  updateOrderHandler,
  deleteOrderHandler,
} from "../controller/orders";
import {
  getProductsHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from "../controller/products";

const router = express.Router();

// User routes
router.get("/users", getUsersHandler);
router.post("/users", createUserHandler);
router.patch("/users/:id", updateUserHandler);
router.delete("/users/:id", deleteUserHandler);

// Category routes
router.get("/categories", getCategoriesHandler);
router.post("/categories", createCategoryHandler);
router.patch("/categories/:id", updateCategoryHandler);
router.delete("/categories/:id", deleteCategoryHandler);

// Product routes
router.get("/products", getProductsHandler);
router.post("/products", createProductHandler);
router.patch("/products/:id", updateProductHandler);
router.delete("/products/:id", deleteProductHandler);

// Order routes
router.get("/orders", getOrdersHandler);
router.post("/orders", createOrderHandler);
router.patch("/orders/:id", updateOrderHandler);
router.delete("/orders/:id", deleteOrderHandler);

export default router;
