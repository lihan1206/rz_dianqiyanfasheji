import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { hashPassword } from "../utils/password.js";

const router = Router();

const createSchema = z.object({
  body: z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    name: z.string().min(2),
    role: z.nativeEnum(Role),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(30).optional().or(z.literal(""))
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, username: true, name: true, role: true, email: true, phone: true, createdAt: true }
    });

    res.json({ message: "获取用户列表成功", data: users });
  })
);

router.post(
  "/",
  authRequired,
  requireRoles("ADMIN"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { username, password, name, role, email, phone } = req.validated.body;
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        name,
        role,
        email: email || null,
        phone: phone || null
      },
      select: { id: true, username: true, name: true, role: true, email: true, phone: true }
    });

    res.status(201).json({ message: "创建用户成功", data: user });
  })
);

export default router;
