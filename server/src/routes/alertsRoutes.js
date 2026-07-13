import { Router } from "express";
import { listAlerts, getAlert, closeAlert, createAlert } from "../controllers/alertsController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, listAlerts);
router.get("/:id", requireAuth, getAlert);
router.post("/", requireAuth, createAlert);
router.put("/:id/close", requireAuth, closeAlert);

export default router;
