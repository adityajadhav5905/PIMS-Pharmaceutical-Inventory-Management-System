import { Router } from "express";
import { getFinancialSummary, getEmployeePerformance } from "../controllers/financialsController.js";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, requireRole(["Admin"]), getFinancialSummary);
router.get("/summary", requireAuth, requireRole(["Admin"]), getFinancialSummary);
router.get("/employee-performance", requireAuth, requireRole(["Admin"]), getEmployeePerformance);

export default router;
