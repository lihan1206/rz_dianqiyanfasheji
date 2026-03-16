import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ApiError } from "../utils/apiError.js";

const router = Router();

const createBomSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    stage: z.string().min(1),
    version: z.coerce.number().int().positive().optional(),
    projectId: z.coerce.number().int().positive()
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateBomSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    stage: z.string().min(1).optional(),
    version: z.coerce.number().int().positive().optional()
  }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}).optional()
});

const addItemSchema = z.object({
  body: z.object({
    componentId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().optional(),
    supplier: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal(""))
  }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}).optional()
});

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await prisma.bom.findMany({
      include: {
        project: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
        items: { include: { component: true } },
        drawings: { include: { drawing: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ message: "获取BOM列表成功", data });
  })
);

router.post(
  "/",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  validate(createBomSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;

    const project = await prisma.project.findUnique({ where: { id: payload.projectId } });
    if (!project) {
      throw new ApiError(404, "所属项目不存在");
    }

    const data = await prisma.bom.create({
      data: {
        name: payload.name,
        stage: payload.stage,
        version: payload.version ?? 1,
        projectId: payload.projectId,
        createdById: req.user.id
      }
    });

    res.status(201).json({ message: "创建BOM成功", data });
  })
);

router.patch(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  validate(updateBomSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.validated.params.id);
    const payload = req.validated.body;

    const found = await prisma.bom.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "BOM不存在");
    }

    const data = await prisma.bom.update({
      where: { id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.stage ? { stage: payload.stage } : {}),
        ...(payload.version ? { version: payload.version } : {})
      }
    });

    res.json({ message: "更新BOM成功", data });
  })
);

router.delete(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const found = await prisma.bom.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "BOM不存在");
    }

    await prisma.bom.delete({ where: { id } });
    res.json({ message: "删除BOM成功" });
  })
);

router.post(
  "/:id/items",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  validate(addItemSchema),
  asyncHandler(async (req, res) => {
    const bomId = Number(req.validated.params.id);
    const payload = req.validated.body;

    const bom = await prisma.bom.findUnique({ where: { id: bomId } });
    if (!bom) {
      throw new ApiError(404, "BOM不存在");
    }

    const component = await prisma.component.findUnique({ where: { id: payload.componentId } });
    if (!component) {
      throw new ApiError(404, "元器件不存在");
    }

    const data = await prisma.bomItem.create({
      data: {
        bomId,
        componentId: payload.componentId,
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        supplier: payload.supplier || null,
        notes: payload.notes || null
      },
      include: { component: true }
    });

    res.status(201).json({ message: "添加BOM条目成功", data });
  })
);

router.patch(
  "/:id/items/:itemId",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const idSchema = z.object({
      id: z.string().regex(/^\d+$/),
      itemId: z.string().regex(/^\d+$/)
    });
    const bodySchema = z.object({
      quantity: z.coerce.number().int().positive().optional(),
      unitPrice: z.coerce.number().optional(),
      supplier: z.string().optional().or(z.literal("")),
      notes: z.string().optional().or(z.literal(""))
    });

    const ids = idSchema.parse(req.params);
    const body = bodySchema.parse(req.body);

    const data = await prisma.bomItem.update({
      where: { id: Number(ids.itemId) },
      data: {
        ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
        ...(body.unitPrice !== undefined ? { unitPrice: body.unitPrice } : {}),
        ...(body.supplier !== undefined ? { supplier: body.supplier || null } : {}),
        ...(body.notes !== undefined ? { notes: body.notes || null } : {})
      },
      include: { component: true }
    });

    res.json({ message: "更新BOM条目成功", data });
  })
);

router.delete(
  "/:id/items/:itemId",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const itemId = Number(req.params.itemId);
    const found = await prisma.bomItem.findUnique({ where: { id: itemId } });
    if (!found) {
      throw new ApiError(404, "BOM条目不存在");
    }

    await prisma.bomItem.delete({ where: { id: itemId } });
    res.json({ message: "删除BOM条目成功" });
  })
);

router.post(
  "/:id/drawings",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const schema = z.object({ drawingId: z.coerce.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "请求参数校验失败", parsed.error.errors);
    }

    const data = await prisma.bomDrawing.create({
      data: {
        bomId: id,
        drawingId: parsed.data.drawingId
      },
      include: { drawing: true }
    });

    res.status(201).json({ message: "关联图纸成功", data });
  })
);

router.delete(
  "/:id/drawings/:drawingId",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const bomId = Number(req.params.id);
    const drawingId = Number(req.params.drawingId);
    const found = await prisma.bomDrawing.findUnique({
      where: { bomId_drawingId: { bomId, drawingId } }
    });

    if (!found) {
      throw new ApiError(404, "关联关系不存在");
    }

    await prisma.bomDrawing.delete({ where: { bomId_drawingId: { bomId, drawingId } } });
    res.json({ message: "移除图纸关联成功" });
  })
);

export default router;
