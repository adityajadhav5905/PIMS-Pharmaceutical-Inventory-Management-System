import { Router } from "express";
import { exportTransactionsCsv, exportStockCsv } from "../controllers/exportController.js";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/transactions", requireAuth, requireRole(["Admin"]), exportTransactionsCsv);
router.get("/stock", requireAuth, requireRole(["Admin"]), exportStockCsv);

export default router;
