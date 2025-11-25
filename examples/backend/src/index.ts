import userRouter from "./routes";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables from .dev.env file
dotenv.config({ path: ".dev.env" });

const MONGODB_URI = process.env.MONGO_URI || "mongodb://localhost:27017/demo";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log(`✅ Connected to MongoDB: ${MONGODB_URI}`))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const app = express();
app.use(express.json());

app.use("/api", userRouter);

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
