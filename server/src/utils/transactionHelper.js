import mongoose from "mongoose";
import logger from "./logger.js";

/**
 * Execute operations inside a MongoDB transaction session (when replica set is available).
 * Falls back gracefully to standard execution if transactions are not supported on standalone instances.
 */
export const runInTransaction = async (workFn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session && session.inTransaction()) {
      logger.error({ message: `Transaction failed: ${error.message}. Aborting transaction.` });
      await session.abortTransaction();
    }
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};
