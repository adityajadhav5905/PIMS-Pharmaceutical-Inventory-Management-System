import mysql from "mysql2/promise";
import env from "./env.js";
import logger from "../utils/logger.js";

let pool = null;

export const connectDb = async () => {
  if (pool) return pool;

  logger.info({ message: "Connecting to MySQL database..." });
  try {
    pool = mysql.createPool({
      host: env.mysqlHost,
      port: env.mysqlPort,
      user: env.mysqlUser,
      password: env.mysqlPassword,
      database: env.mysqlDatabase,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      // Return BIGINT as number, dates as strings for consistency
      supportBigNumbers: true,
      bigNumberStrings: false,
      dateStrings: false,
      decimalNumbers: true,
      timezone: "+00:00"
    });

    // Test the connection
    const conn = await pool.getConnection();
    logger.info({ message: `MySQL connected successfully: ${env.mysqlHost}:${env.mysqlPort}/${env.mysqlDatabase}` });
    conn.release();
    return pool;
  } catch (err) {
    logger.error({ message: `MySQL connection error: ${err.message}`, stack: err.stack });
    throw err;
  }
};

export const disconnectDb = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info({ message: "MySQL connection pool closed." });
  }
};

export const getPool = () => {
  if (!pool) throw new Error("Database pool not initialized. Call connectDb() first.");
  return pool;
};

export default { connectDb, disconnectDb, getPool };
