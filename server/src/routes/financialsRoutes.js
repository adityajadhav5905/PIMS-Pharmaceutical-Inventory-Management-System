import { Router } from "express";
import { getFinancialSummary } from "../controllers/financialsController.js";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/summary", requireAuth, requireRole(["Admin"]), getFinancialSummary);

export default router;
