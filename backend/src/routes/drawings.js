import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { upload } from "../middleware/upload.js";
import { ApiError } from "../utils/apiError.js";

const router = Router();

const querySchema = z.object({
  keyword: z.string().optional(),
  projectId: z.string().regex(/^\d+$/).optional()
});

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(400, "查询参数格式错误");
    }

    const { keyword = "", projectId } = parsed.data;

    const data = await prisma.drawing.findMany({
      where: {
        name: { contains: keyword },
        ...(projectId ? { projectId: Number(projectId) } : {})
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        uploadedBy: { select: { id: true, name: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ message: "获取图纸列表成功", data });
  })
);

router.post(
  "/",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, "请先上传图纸文件");
    }

    const bodySchema = z.object({
      name: z.string().min(2),
      projectId: z.coerce.number().int().positive(),
      tags: z.string().optional()
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "请求参数校验失败", parsed.error.errors);
    }

    const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project) {
      throw new ApiError(404, "所属项目不存在");
    }

    const data = await prisma.drawing.create({
      data: {
        name: parsed.data.name,
        filePath: `/uploads/${req.file.filename}`,
        fileType: path.extname(req.file.originalname).replace(".", "").toUpperCase(),
        tags: parsed.data.tags || null,
        projectId: parsed.data.projectId,
        uploadedById: req.user.id
      }
    });

    res.status(201).json({ message: "上传图纸成功", data });
  })
);

router.patch(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const bodySchema = z.object({
      name: z.string().min(2).optional(),
      tags: z.string().optional(),
      version: z.coerce.number().int().positive().optional()
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "请求参数校验失败", parsed.error.errors);
    }

    const found = await prisma.drawing.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "图纸不存在");
    }

    const data = await prisma.drawing.update({
      where: { id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags || null } : {}),
        ...(parsed.data.version ? { version: parsed.data.version } : {})
      }
    });

    res.json({ message: "更新图纸成功", data });
  })
);

router.delete(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const found = await prisma.drawing.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "图纸不存在");
    }

    const absPath = path.join("/app", found.filePath);
    if (fs.existsSync(absPath)) {
      fs.unlinkSync(absPath);
    }

    await prisma.drawing.delete({ where: { id } });
    res.json({ message: "删除图纸成功" });
  })
);

export default router;
