import express from "express";
import mongoose from "mongoose";

mongoose
  .connect("mongodb://localhost:27017/demo")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const app = express();
app.use(express.json());

import userRouter from "./routes/users.js";

app.use("/api", userRouter);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
