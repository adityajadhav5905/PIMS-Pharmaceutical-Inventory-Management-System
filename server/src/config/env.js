import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });

const nodeEnv = process.env.NODE_ENV || "development";

// Enforce required JWT secrets in production environment
if (nodeEnv === "production") {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error(
      "FATAL CONFIGURATION ERROR: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be explicitly set via environment variables in production."
    );
  }
}

const env = {
  port: Number(process.env.SERVER_PORT || process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pims",
  accessSecret: process.env.JWT_ACCESS_SECRET || (nodeEnv === "test" ? "test_access_secret_64_bytes_00000000000000000000000000000000" : "dev_access_secret_64_bytes_00000000000000000000000000000000"),
  refreshSecret: process.env.JWT_REFRESH_SECRET || (nodeEnv === "test" ? "test_refresh_secret_64_bytes_00000000000000000000000000000000" : "dev_refresh_secret_64_bytes_00000000000000000000000000000000"),
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFrom: process.env.SMTP_FROM || "",
  nodeEnv
};

export default env;
