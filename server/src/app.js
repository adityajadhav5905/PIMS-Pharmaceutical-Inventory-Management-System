import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import env from "./config/env.js";
import routes from "./routes/index.js";
import errorHandler from "./middlewares/errorHandler.js";
import { tenantMiddleware } from "./middlewares/tenantMiddleware.js";

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

/** Allow local dev origins (localhost + 127.0.0.1 on any port). */
const isDevOrigin = (origin) =>
  !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const allowedOrigins = (env.clientUrl || "")
  .split(",")
  .map((u) => u.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.nodeEnv !== "production" && isDevOrigin(origin)) {
        return callback(null, true);
      }
      const cleanOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(cleanOrigin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      // Support Vercel deployment preview URLs if clientUrl contains vercel.app
      if (allowedOrigins.some((ao) => ao.includes("vercel.app")) && cleanOrigin.endsWith(".vercel.app")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-pharmacy-id"]
  })
);

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(tenantMiddleware);

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/v1", routes);
app.use(errorHandler);

export default app;
