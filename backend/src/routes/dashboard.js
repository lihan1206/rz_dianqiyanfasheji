import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authRequired } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";

const router = Router();

router.get(
  "/summary",
  authRequired,
  asyncHandler(async (req, res) => {
    const [projectTotal, drawingTotal, bomTotal, componentTotal, pendingReview] = await Promise.all([
      prisma.project.count(),
      prisma.drawing.count(),
      prisma.bom.count(),
      prisma.component.count(),
      prisma.designReview.count({ where: { status: "PENDING" } })
    ]);

    res.json({
      message: "获取看板数据成功",
      data: {
        projectTotal,
        drawingTotal,
        bomTotal,
        componentTotal,
        pendingReview
      }
    });
  })
);

export default router;
