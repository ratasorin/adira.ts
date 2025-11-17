import express from "express";
import { getUsersHandler } from "../controller/users";

const router = express.Router();

router.get("/users", getUsersHandler);

export default router;
