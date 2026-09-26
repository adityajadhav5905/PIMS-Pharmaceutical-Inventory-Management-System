import { Router } from "express";
import {
  createInventoryBatch,
  createMedicine,
  getMedicine,
  updateMedicine,
  deleteMedicine,
  createTransaction,
  deleteInventoryBatch,
  deleteTransaction,
  listAvailableStock,
  listInventory,
  listMedicines,
  listTransactions,
  sellStock,
  updateInventoryBatch,
  updateTransaction
} from "../controllers/inventoryController.js";
import { requireAuth, requireRole } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validate.js";
import {
  inventorySchema,
  inventoryUpdateSchema,
  medicineSchema,
  sellSchema,
  transactionSchema,
  transactionUpdateSchema
} from "../validations/inventoryValidation.js";

const router = Router();

router.get("/medicines", requireAuth, listMedicines);
router.get("/medicines/:id", requireAuth, getMedicine);
router.post("/medicines", requireAuth, requireRole(["Admin"]), validateBody(medicineSchema), createMedicine);
router.put("/medicines/:id", requireAuth, requireRole(["Admin"]), updateMedicine);
router.patch("/medicines/:id", requireAuth, requireRole(["Admin"]), updateMedicine);
router.delete("/medicines/:id", requireAuth, requireRole(["Admin"]), deleteMedicine);

router.get("/available", requireAuth, listAvailableStock);
router.get("/", requireAuth, listInventory);
router.post("/", requireAuth, requireRole(["Admin", "Pharmacist"]), validateBody(inventorySchema), createInventoryBatch);
router.post("/sell", requireAuth, requireRole(["Admin", "Pharmacist"]), validateBody(sellSchema), sellStock);
router.patch("/:id", requireAuth, requireRole(["Admin", "Pharmacist"]), validateBody(inventoryUpdateSchema), updateInventoryBatch);
router.delete("/:id", requireAuth, requireRole(["Admin"]), deleteInventoryBatch);

router.get("/transactions", requireAuth, listTransactions);
router.post(
  "/transactions",
  requireAuth,
  requireRole(["Admin", "Pharmacist"]),
  validateBody(transactionSchema),
  createTransaction
);
router.patch(
  "/transactions/:id",
  requireAuth,
  requireRole(["Admin", "Pharmacist"]),
  validateBody(transactionUpdateSchema),
  updateTransaction
);
router.delete("/transactions/:id", requireAuth, requireRole(["Admin"]), deleteTransaction);

export default router;
