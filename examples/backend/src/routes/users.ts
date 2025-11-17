import express from "express";
import mongoose from "mongoose";
import { IUser } from "../models/User.js";

const router = express.Router();

// Typed handlers using User schema
const getUsers = (req: express.Request, res: express.Response<IUser[]>) => {
  // Mock for demo
  const mockUsers: IUser[] = [
    {
      _id: new mongoose.Types.ObjectId(),
      name: "John Doe",
      email: "john@example.com",
      createdAt: new Date(),
    },
  ];
  res.json(mockUsers);
};

const createUser = (
  req: express.Request<{}, IUser, { name: string; email: string; age: number }>,
  res: express.Response<IUser & { age: number }>,
) => {
  const { name, email, age } = req.body;
  // Mock creation
  const newUser: IUser = {
    _id: new mongoose.Types.ObjectId(),
    name,
    email,
    createdAt: new Date(),
  };
  res.status(201).json({ ...newUser, age });
};

// Routes
router.get("/users", getUsers);
router.post("/users", createUser);

export default router;
