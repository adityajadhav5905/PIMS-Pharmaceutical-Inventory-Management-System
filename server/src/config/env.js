import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });

const env = {
  port: process.env.SERVER_PORT || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pims",
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8000",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  nodeEnv: process.env.NODE_ENV || "development"
};

export default env;
