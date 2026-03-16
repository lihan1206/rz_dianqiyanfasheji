import { Router } from "express";
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
    partNumber: z.string().min(2),
    category: z.string().min(1),
    specification: z.string().optional().or(z.literal("")),
    packageType: z.string().optional().or(z.literal("")),
    voltageRating: z.coerce.number().optional(),
    powerRating: z.coerce.number().optional(),
    price: z.coerce.number().optional(),
    manufacturer: z.string().optional().or(z.literal("")),
    datasheetUrl: z.string().url().optional().or(z.literal(""))
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    partNumber: z.string().min(2).optional(),
    category: z.string().min(1).optional(),
    specification: z.string().optional(),
    packageType: z.string().optional(),
    voltageRating: z.coerce.number().optional(),
    powerRating: z.coerce.number().optional(),
    price: z.coerce.number().optional(),
    manufacturer: z.string().optional(),
    datasheetUrl: z.string().url().optional().or(z.literal(""))
  }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}).optional()
});

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const { keyword = "", category } = req.query;
    const data = await prisma.component.findMany({
      where: {
        name: { contains: String(keyword) },
        ...(category ? { category: String(category) } : {})
      },
      orderBy: { updatedAt: "desc" }
    });

    res.json({ message: "获取元器件列表成功", data });
  })
);

router.post(
  "/",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const payload = req.validated.body;
    const data = await prisma.component.create({
      data: {
        name: payload.name,
        partNumber: payload.partNumber,
        category: payload.category,
        specification: payload.specification || null,
        packageType: payload.packageType || null,
        voltageRating: payload.voltageRating,
        powerRating: payload.powerRating,
        price: payload.price,
        manufacturer: payload.manufacturer || null,
        datasheetUrl: payload.datasheetUrl || null
      }
    });

    res.status(201).json({ message: "创建元器件成功", data });
  })
);

router.patch(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.validated.params.id);
    const payload = req.validated.body;

    const found = await prisma.component.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "元器件不存在");
    }

    const data = await prisma.component.update({
      where: { id },
      data: {
        ...(payload.name ? { name: payload.name } : {}),
        ...(payload.partNumber ? { partNumber: payload.partNumber } : {}),
        ...(payload.category ? { category: payload.category } : {}),
        ...(payload.specification !== undefined ? { specification: payload.specification || null } : {}),
        ...(payload.packageType !== undefined ? { packageType: payload.packageType || null } : {}),
        ...(payload.voltageRating !== undefined ? { voltageRating: payload.voltageRating } : {}),
        ...(payload.powerRating !== undefined ? { powerRating: payload.powerRating } : {}),
        ...(payload.price !== undefined ? { price: payload.price } : {}),
        ...(payload.manufacturer !== undefined ? { manufacturer: payload.manufacturer || null } : {}),
        ...(payload.datasheetUrl !== undefined ? { datasheetUrl: payload.datasheetUrl || null } : {})
      }
    });

    res.json({ message: "更新元器件成功", data });
  })
);

router.delete(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "ENGINEER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const found = await prisma.component.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "元器件不存在");
    }

    await prisma.component.delete({ where: { id } });
    res.json({ message: "删除元器件成功" });
  })
);

export default router;
