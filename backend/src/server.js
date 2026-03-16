import fs from "node:fs";
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

if (!fs.existsSync(env.uploadDir)) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
}

app.listen(env.port, () => {
  logger.info(`后端服务已启动，端口: ${env.port}`);
});
