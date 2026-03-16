import { ApiError } from "../utils/apiError.js";
import { logger } from "../config/logger.js";

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  logger.error(
    {
      err,
      path: req.path,
      method: req.method,
      requestId: req.id
    },
    "请求处理失败"
  );

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      message: err.message,
      details: err.details ?? null
    });
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "请求参数校验失败",
      details: err.errors
    });
  }

  if (err.code === "P2002") {
    return res.status(409).json({
      message: "数据已存在，请勿重复提交"
    });
  }

  return res.status(500).json({
    message: "服务器内部错误"
  });
};
