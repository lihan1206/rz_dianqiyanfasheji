import { Router } from "express";
import { ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ApiError } from "../utils/apiError.js";

const router = Router();

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    code: z.string().min(2),
    description: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(ProjectStatus).optional(),
    startDate: z.string().datetime().optional().or(z.literal("")),
    endDate: z.string().datetime().optional().or(z.literal("")),
    managerId: z.coerce.number().int().positive()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(2).optional(),
    description: z.string().optional(),
    status: z.nativeEnum(ProjectStatus).optional(),
    startDate: z.string().datetime().optional().or(z.literal("")),
    endDate: z.string().datetime().optional().or(z.literal("")),
    managerId: z.coerce.number().int().positive().optional()
  }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}).optional()
});

const addMemberSchema = z.object({
  body: z.object({
    userId: z.coerce.number().int().positive()
  }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}).optional()
});

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const { keyword = "", status } = req.query;
    const projects = await prisma.project.findMany({
      where: {
        name: { contains: String(keyword) },
        ...(status ? { status: String(status) } : {})
      },
      include: {
        manager: { select: { id: true, name: true, username: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ message: "获取项目列表成功", data: projects });
  })
);

router.post(
  "/",
  authRequired,
  requireRoles("ADMIN", "MANAGER"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    const manager = await prisma.user.findUnique({ where: { id: payload.managerId } });
    if (!manager) {
      throw new ApiError(400, "负责人不存在");
    }

    const project = await prisma.project.create({
      data: {
        name: payload.name,
        code: payload.code,
        description: payload.description || null,
        status: payload.status ?? "PLANNING",
        startDate: payload.startDate ? new Date(payload.startDate) : null,
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        managerId: payload.managerId
      }
    });

    res.status(201).json({ message: "创建项目成功", data: project });
  })
);

router.patch(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "MANAGER"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.validated.params.id);
    const payload = req.validated.body;

    const found = await prisma.project.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "项目不存在");
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.code ? { code: payload.code } : {}),
        ...(payload.description !== undefined ? { description: payload.description || null } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.startDate !== undefined
          ? { startDate: payload.startDate ? new Date(payload.startDate) : null }
          : {}),
        ...(payload.endDate !== undefined
          ? { endDate: payload.endDate ? new Date(payload.endDate) : null }
          : {}),
        ...(payload.managerId ? { managerId: payload.managerId } : {})
      }
    });

    res.json({ message: "更新项目成功", data: project });
  })
);

router.delete(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const found = await prisma.project.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "项目不存在");
    }

    await prisma.project.delete({ where: { id } });
    res.json({ message: "删除项目成功" });
  })
);

router.post(
  "/:id/members",
  authRequired,
  requireRoles("ADMIN", "MANAGER"),
  validate(addMemberSchema),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.validated.params.id);
    const { userId } = req.validated.body;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new ApiError(404, "项目不存在");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new ApiError(404, "成员不存在");
    }

    const member = await prisma.projectMember.create({
      data: { projectId, userId },
      include: { user: { select: { id: true, name: true, role: true } } }
    });

    res.status(201).json({ message: "添加成员成功", data: member });
  })
);

router.delete(
  "/:id/members/:userId",
  authRequired,
  requireRoles("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const projectId = Number(req.params.id);
    const userId = Number(req.params.userId);

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });

    if (!member) {
      throw new ApiError(404, "项目成员不存在");
    }

    await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
    res.json({ message: "移除成员成功" });
  })
);

export default router;
