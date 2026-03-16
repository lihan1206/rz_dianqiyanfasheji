import { Router } from "express";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import projectRoutes from "./projects.js";
import componentRoutes from "./components.js";
import drawingRoutes from "./drawings.js";
import bomRoutes from "./boms.js";
import reviewRoutes from "./reviews.js";
import dashboardRoutes from "./dashboard.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ message: "服务运行正常", data: { status: "ok", timestamp: Date.now() } });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/projects", projectRoutes);
router.use("/components", componentRoutes);
router.use("/drawings", drawingRoutes);
router.use("/boms", bomRoutes);
router.use("/reviews", reviewRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
