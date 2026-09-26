import { Router } from "express";
import { exportTransactionsCsv, exportStockCsv, exportStaffPerformanceCsv } from "../controllers/exportController.js";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/transactions", requireAuth, requireRole(["Admin"]), exportTransactionsCsv);
router.get("/stock", requireAuth, requireRole(["Admin"]), exportStockCsv);
router.get("/staff-performance", requireAuth, requireRole(["Admin"]), exportStaffPerformanceCsv);

export default router;
