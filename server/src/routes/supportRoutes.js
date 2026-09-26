import { Router } from "express";
import { submitTicket, listTickets, updateTicketStatus } from "../controllers/supportController.js";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/", requireAuth, submitTicket);
router.get("/", requireAuth, requireRole(["Admin"]), listTickets);
router.patch("/:id/status", requireAuth, requireRole(["Admin"]), updateTicketStatus);
router.put("/:id", requireAuth, requireRole(["Admin"]), updateTicketStatus);

export default router;
