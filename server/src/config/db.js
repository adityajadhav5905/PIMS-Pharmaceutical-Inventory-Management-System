import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";

export const connectDb = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  logger.info({ message: "Connecting to MongoDB database..." });
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      autoIndex: true
    });
    logger.info({ message: `MongoDB connected successfully: ${conn.connection.host}/${conn.connection.name}` });
    return conn.connection;
  } catch (err) {
    logger.error({ message: `MongoDB connection error: ${err.message}`, stack: err.stack });
    throw err;
  }
};

export const disconnectDb = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info({ message: "MongoDB disconnected." });
  }
};
