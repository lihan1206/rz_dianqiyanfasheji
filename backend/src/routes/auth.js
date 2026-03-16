import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { comparePassword } from "../utils/password.js";
import { signToken } from "../utils/token.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { authRequired } from "../middleware/auth.js";
import { ApiError } from "../utils/apiError.js";

const router = Router();

const loginSchema = z.object({
  body: z.object({
    username: z.string().min(3, "用户名至少 3 位"),
    password: z.string().min(6, "密码至少 6 位")
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new ApiError(401, "用户名或密码错误");
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new ApiError(401, "用户名或密码错误");
    }

    const token = signToken({ userId: user.id, role: user.role });

    return res.json({
      message: "登录成功",
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      }
    });
  })
);

router.get(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        email: true,
        phone: true
      }
    });

    res.json({ message: "获取当前用户成功", data: user });
  })
);

export default router;
