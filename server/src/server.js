import app from "./app.js";
import env from "./config/env.js";
import { connectDb } from "./config/db.js";
import { startAlertJob } from "./jobs/alertJob.js";
import logger from "./utils/logger.js";

const start = async () => {
  await connectDb();
  startAlertJob();
  app.listen(env.port, () => {
    logger.info({ message: `Server running on port ${env.port}` });
  });
};

start().catch((error) => {
  logger.error({ message: error.message });
  process.exit(1);
});
