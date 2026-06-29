import "dotenv/config";
import cors from "cors";
import express from "express";
import { CORS_ALLOWED_ORIGIN_SET, normalizeOriginValue } from "../config/environment.js";

const app = express();

// Trust proxy header (X-Forwarded-For) from Cloudflare/Nginx/ngrok
app.set("trust proxy", 1);


app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const normalizedOrigin = normalizeOriginValue(origin);
      if (!normalizedOrigin || CORS_ALLOWED_ORIGIN_SET.has(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }),
);
app.use(
  express.json({
    verify(req, _res, buffer) {
      req.rawBody = buffer.toString("utf8");
    },
  }),
);

export { app };

export * from "../store.js";
export * from "../r2.js";
export * from "../navMenu.js";
export * from "../redisCache.js";
export * from "../utils.js";

export * from "../config/environment.js";
export * from "../auth/index.js";
export * from "../validators/index.js";
export * from "../cache/index.js";
export * from "../payments/index.js";
export * from "../uploads/index.js";
export * from "../utils/runtimeHelpers.js";
export * from "../errors/index.js";
