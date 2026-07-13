import { Router } from "express";
import authRoutes from "./authRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";
import alertsRoutes from "./alertsRoutes.js";
import predictionRoutes from "./predictionRoutes.js";
import staffRoutes from "./staffRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import financialsRoutes from "./financialsRoutes.js";
import exportRoutes from "./exportRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/alerts", alertsRoutes);
router.use("/predictions", predictionRoutes);
router.use("/staff", staffRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/financials", financialsRoutes);
router.use("/export", exportRoutes);

export default router;
