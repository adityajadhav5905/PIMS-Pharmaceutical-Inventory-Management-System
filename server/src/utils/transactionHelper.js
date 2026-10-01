import { getConnection } from "../models/index.js";
import logger from "./logger.js";

/**
 * Execute operations inside a MySQL transaction with row locking support.
 * The callback receives a mysql2 connection with an active transaction.
 */
export const runInTransaction = async (workFn) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const result = await workFn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    logger.error({ message: `Transaction failed: ${error.message}. Rolling back.` });
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};
