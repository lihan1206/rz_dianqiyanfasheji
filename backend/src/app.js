import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import path from "node:path";
import { logger } from "./config/logger.js";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(helmet());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));
app.use("/uploads", express.static(path.resolve(env.uploadDir)));

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
