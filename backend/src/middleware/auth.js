import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { verifyToken } from "../utils/token.js";

export const authRequired = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new ApiError(401, "未授权，请先登录"));
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return next(new ApiError(401, "用户不存在或登录已失效"));
    }
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name
    };
    return next();
  } catch (error) {
    return next(new ApiError(401, "登录状态已过期，请重新登录"));
  }
};

export const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "未授权，请先登录"));
  }

  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, "当前账号无权限执行该操作"));
  }

  return next();
};
