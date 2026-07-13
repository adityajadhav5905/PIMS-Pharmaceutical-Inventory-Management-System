import { Router } from "express";
import {
    listStaff,
    getStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    getStaffSales
} from "../controllers/staffController.js";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, requireRole(["Admin"]), listStaff);
router.get("/sales", requireAuth, requireRole(["Admin"]), getStaffSales);
router.get("/:id", requireAuth, requireRole(["Admin"]), getStaff);
router.post("/", requireAuth, requireRole(["Admin"]), createStaff);
router.put("/:id", requireAuth, requireRole(["Admin"]), updateStaff);
router.delete("/:id", requireAuth, requireRole(["Admin"]), deleteStaff);

export default router;
