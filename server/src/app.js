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

app.use(
  cors({
    origin(origin, callback) {
      if (env.nodeEnv === "development" && isDevOrigin(origin)) {
        return callback(null, true);
      }
      if (origin === env.clientUrl || !origin) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
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
