import { Router } from "express";
import { ReviewStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authRequired, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { ApiError } from "../utils/apiError.js";

const router = Router();

const createSchema = z.object({
  body: z.object({
    drawingId: z.coerce.number().int().positive(),
    reviewerId: z.coerce.number().int().positive(),
    comment: z.string().optional().or(z.literal(""))
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional()
});

const updateSchema = z.object({
  body: z.object({
    status: z.nativeEnum(ReviewStatus),
    comment: z.string().optional().or(z.literal(""))
  }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}).optional()
});

router.get(
  "/",
  authRequired,
  asyncHandler(async (req, res) => {
    const data = await prisma.designReview.findMany({
      include: {
        drawing: { select: { id: true, name: true, version: true } },
        reviewer: { select: { id: true, name: true } },
        submitter: { select: { id: true, name: true } }
      },
      orderBy: { updatedAt: "desc" }
    });
    res.json({ message: "获取审批列表成功", data });
  })
);

router.post(
  "/",
  authRequired,
  requireRoles("ADMIN", "MANAGER", "ENGINEER"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const { drawingId, reviewerId, comment } = req.validated.body;

    const drawing = await prisma.drawing.findUnique({ where: { id: drawingId } });
    if (!drawing) {
      throw new ApiError(404, "图纸不存在");
    }

    const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
    if (!reviewer) {
      throw new ApiError(404, "审核人不存在");
    }

    const data = await prisma.designReview.create({
      data: {
        drawingId,
        reviewerId,
        submitterId: req.user.id,
        comment: comment || null
      }
    });

    res.status(201).json({ message: "发起审批成功", data });
  })
);

router.patch(
  "/:id",
  authRequired,
  requireRoles("ADMIN", "REVIEWER", "MANAGER"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.validated.params.id);
    const { status, comment } = req.validated.body;

    const found = await prisma.designReview.findUnique({ where: { id } });
    if (!found) {
      throw new ApiError(404, "审批记录不存在");
    }

    const data = await prisma.designReview.update({
      where: { id },
      data: {
        status,
        comment: comment || null
      }
    });

    res.json({ message: "审批状态更新成功", data });
  })
);

export default router;
