import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import env from "./env.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  // Connect to MySQL server without database specified
  const conn = await mysql.createConnection({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    multipleStatements: true
  });

  logger.info({ message: "Connected to MySQL server for initialization..." });

  const databases = ["pims", "pims_test"];

  for (const db of databases) {
    logger.info({ message: `Ensuring database '${db}' exists and applying schema...` });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${db}\``);
    await conn.query(schemaSql);
    logger.info({ message: `Database '${db}' schema applied successfully!` });
  }

  await conn.end();
  logger.info({ message: "MySQL database initialization completed successfully." });
}

// If executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeDatabase()
    .then(() => {
      logger.info({ message: "Database init finished." });
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ message: `Database init failed: ${err.message}`, stack: err.stack });
      process.exit(1);
    });
}
