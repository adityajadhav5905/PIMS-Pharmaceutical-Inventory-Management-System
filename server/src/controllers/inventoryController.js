import { Medicine, Inventory, Transaction, Staff } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkAlertsForBatch } from "../jobs/alertJob.js";

/** List all medicine catalog items. */
export const getMedicines = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const medicines = await Medicine.findActiveByPharmacy(pharmacyDbId);

  return res.json({
    success: true,
    data: medicines.map((m) => ({
      _id: m.id,
      id: m.id,
      name: m.name,
      sku: m.sku,
      brand: m.brand,
      description: m.description,
      category: m.category,
      supplier: m.supplier,
      buyingPrice: m.buyingPrice,
      sellingPrice: m.sellingPrice,
      leadTimeDays: m.leadTimeDays,
      createdAt: m.createdAt
    }))
  });
});

/** Get single medicine by ID. */
export const getMedicine = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const medicine = await Medicine.findByIdAndPharmacy(req.params.id, pharmacyDbId);

  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found" });
  }

  return res.json({
    success: true,
    data: {
      _id: medicine.id,
      id: medicine.id,
      name: medicine.name,
      sku: medicine.sku,
      brand: medicine.brand,
      description: medicine.description,
      category: medicine.category,
      supplier: medicine.supplier,
      buyingPrice: medicine.buyingPrice,
      sellingPrice: medicine.sellingPrice,
      leadTimeDays: medicine.leadTimeDays,
      createdAt: medicine.createdAt
    }
  });
});

/** Create a standalone Medicine record in the catalog. */
export const createMedicine = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { name, sku, brand, description, category, supplier, buyingPrice, sellingPrice, leadTimeDays } = req.body;

  const existing = await Medicine.findBySkuAndPharmacy(sku, pharmacyDbId);
  if (existing) {
    return res.status(400).json({ success: false, message: "A medicine with this SKU already exists." });
  }

  const medicine = await Medicine.create({
    pharmacyId: pharmacyDbId,
    name,
    sku: sku || `MED-${Date.now()}`,
    brand: brand || "",
    description: description || "",
    category: category || "",
    supplier: supplier || "",
    buyingPrice: Number(buyingPrice) || 0,
    sellingPrice: Number(sellingPrice) || 0,
    leadTimeDays: Number(leadTimeDays) || 7
  });

  return res.status(201).json({
    success: true,
    data: {
      _id: medicine.id,
      id: medicine.id,
      name: medicine.name,
      sku: medicine.sku,
      brand: medicine.brand,
      description: medicine.description,
      category: medicine.category,
      supplier: medicine.supplier,
      buyingPrice: medicine.buyingPrice,
      sellingPrice: medicine.sellingPrice,
      leadTimeDays: medicine.leadTimeDays,
      createdAt: medicine.createdAt
    }
  });
});

/** Update medicine catalog item. */
export const updateMedicine = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const medicine = await Medicine.findByIdAndPharmacy(req.params.id, pharmacyDbId);

  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found" });
  }

  const updates = {};
  const fields = ["name", "sku", "brand", "description", "category", "supplier", "buyingPrice", "sellingPrice", "leadTimeDays"];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = f.includes("Price") || f.includes("leadTime") ? Number(req.body[f]) : req.body[f];
    }
  }

  if (Object.keys(updates).length > 0) {
    await Medicine.updateById(medicine.id, updates);
  }

  const updated = await Medicine.findById(medicine.id);

  return res.json({
    success: true,
    data: {
      _id: updated.id,
      id: updated.id,
      name: updated.name,
      sku: updated.sku,
      brand: updated.brand,
      description: updated.description,
      category: updated.category,
      supplier: updated.supplier,
      buyingPrice: updated.buyingPrice,
      sellingPrice: updated.sellingPrice,
      leadTimeDays: updated.leadTimeDays,
      createdAt: updated.createdAt
    }
  });
});

/** Delete medicine catalog item (checks if referenced by inventory). */
export const deleteMedicine = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const batchCount = await Inventory.countByMedicineAndPharmacy(req.params.id, pharmacyDbId);

  if (batchCount > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete medicine that is referenced by active inventory batches. Delete batches first."
    });
  }

  const medicine = await Medicine.findByIdAndPharmacy(req.params.id, pharmacyDbId);
  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found" });
  }

  await Medicine.deleteByIdAndPharmacy(req.params.id, pharmacyDbId);

  return res.json({ success: true, message: "Medicine deleted successfully" });
});

/** Helper to resolve or upsert medicine during batch creation. */
const resolveMedicineId = async (payload, pharmacyDbId) => {
  if (payload.medicine) {
    const med = await Medicine.findByIdAndPharmacy(payload.medicine, pharmacyDbId);
    if (med) {
      if (payload.category !== undefined) {
        await Medicine.updateById(med.id, { category: payload.category });
      }
      return med.id;
    }
  }

  const name = (payload.name || payload.medicine || "").trim();
  if (!name) throw new Error("Medicine name is required");

  let med = await Medicine.findByNameAndPharmacy(name, pharmacyDbId);
  if (med) {
    const medUpdates = {};
    if (payload.brand !== undefined) medUpdates.brand = payload.brand;
    if (payload.description !== undefined) medUpdates.description = payload.description;
    if (payload.category !== undefined) medUpdates.category = payload.category;
    if (payload.buyingPrice !== undefined) medUpdates.buyingPrice = Number(payload.buyingPrice);
    if (payload.sellingPrice !== undefined) medUpdates.sellingPrice = Number(payload.sellingPrice);
    if (Object.keys(medUpdates).length > 0) {
      await Medicine.updateById(med.id, medUpdates);
    }
    return med.id;
  }

  med = await Medicine.create({
    pharmacyId: pharmacyDbId,
    name,
    sku: `MED-${Date.now()}`,
    brand: payload.brand || "",
    description: payload.description || "",
    category: payload.category || "",
    buyingPrice: Number(payload.buyingPrice) || 0,
    sellingPrice: Number(payload.sellingPrice) || 0
  });

  return med.id;
};

/** List inventory batches with search and pagination. */
export const getInventory = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const search = req.query.search || "";

  let medIds = null;
  let batchSearch = null;
  if (search) {
    medIds = await Medicine.searchByPharmacy(pharmacyDbId, search);
    batchSearch = search;
  }

  const { total, rows } = await Inventory.findByPharmacyPaginated(pharmacyDbId, { page, limit, search, medIds, batchSearch });

  return res.json({
    success: true,
    data: rows,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  });
});

/** Create a new inventory batch. */
export const createInventory = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { batchNumber, currentStock, reorderLevel, expiryDate } = req.body;

  if (Number(currentStock) < 0) {
    return res.status(400).json({ success: false, message: "Current stock cannot be negative." });
  }

  const medicineId = await resolveMedicineId(req.body, pharmacyDbId);

  const batch = await Inventory.create({
    pharmacyId: pharmacyDbId,
    medicineId,
    batchNumber,
    currentStock: Number(currentStock) || 0,
    reorderLevel: Number(reorderLevel) || 20,
    expiryDate: new Date(expiryDate)
  });

  // Record initial IN transaction
  const medicine = await Medicine.findById(medicineId);
  if (Number(currentStock) > 0 && medicine) {
    await Transaction.create({
      pharmacyId: pharmacyDbId,
      medicineId,
      inventoryId: batch.id,
      type: "IN",
      quantity: Number(currentStock),
      unitBuyPrice: medicine.buyingPrice,
      unitSellPrice: medicine.sellingPrice,
      totalCost: medicine.buyingPrice * Number(currentStock),
      totalRevenue: 0,
      profit: 0,
      note: "Initial stock batch creation"
    });
  }

  // Trigger alert check
  await checkAlertsForBatch(batch.id);

  return res.status(201).json({
    success: true,
    data: {
      _id: batch.id,
      id: batch.id,
      batchNumber: batch.batchNumber,
      currentStock: batch.currentStock,
      reorderLevel: batch.reorderLevel,
      expiryDate: batch.expiryDate,
      medicine: medicine ? {
        _id: medicine.id,
        id: medicine.id,
        name: medicine.name,
        brand: medicine.brand,
        buyingPrice: medicine.buyingPrice,
        sellingPrice: medicine.sellingPrice
      } : null
    }
  });
});

/** Update inventory batch. */
export const updateInventory = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const batch = await Inventory.findByIdAndPharmacy(req.params.id, pharmacyDbId);

  if (!batch) {
    return res.status(404).json({ success: false, message: "Inventory batch not found" });
  }

  const updates = {};
  const { batchNumber, currentStock, reorderLevel, expiryDate } = req.body;
  if (batchNumber !== undefined) updates.batchNumber = batchNumber;
  if (currentStock !== undefined) updates.currentStock = Number(currentStock);
  if (reorderLevel !== undefined) updates.reorderLevel = Number(reorderLevel);
  if (expiryDate !== undefined) updates.expiryDate = new Date(expiryDate);

  if (Object.keys(updates).length > 0) {
    await Inventory.updateById(batch.id, updates);
  }

  await checkAlertsForBatch(batch.id);

  const updated = await Inventory.findById(batch.id);

  return res.json({
    success: true,
    data: {
      _id: updated.id,
      id: updated.id,
      batchNumber: updated.batchNumber,
      currentStock: updated.currentStock,
      reorderLevel: updated.reorderLevel,
      expiryDate: updated.expiryDate
    }
  });
});

/** Delete inventory batch. */
export const deleteInventory = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const batch = await Inventory.findByIdAndPharmacy(req.params.id, pharmacyDbId);

  if (!batch) {
    return res.status(404).json({ success: false, message: "Inventory batch not found" });
  }

  await Inventory.deleteByIdAndPharmacy(req.params.id, pharmacyDbId);

  return res.json({ success: true, message: "Inventory batch deleted successfully" });
});

/** Sell stock atomically with concurrency lock & expiry check. */
export const sellStock = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { inventoryId, quantity, employeeId, note } = req.body;
  const qty = Number(quantity);

  if (!qty || qty <= 0) {
    return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
  }

  const batch = await Inventory.findByIdWithMedicine(inventoryId, pharmacyDbId);
  if (!batch) {
    return res.status(404).json({ success: false, message: "Inventory batch not found" });
  }

  // Check expiry
  if (new Date(batch.expiryDate) < new Date()) {
    return res.status(400).json({ success: false, message: "Cannot sell expired stock." });
  }

  // Verify staff employee belongs to current pharmacy tenant BEFORE modifying stock
  let verifiedStaff = null;
  if (employeeId) {
    verifiedStaff = await Staff.findByIdAndPharmacy(employeeId, pharmacyDbId);
    if (!verifiedStaff) {
      return res.status(400).json({
        success: false,
        message: "Invalid or unauthorized employee ID for this pharmacy workspace."
      });
    }
  }

  // Atomic decrement with row locking via SELECT FOR UPDATE
  const updatedBatch = await Inventory.atomicDecrement(inventoryId, pharmacyDbId, qty);

  if (!updatedBatch) {
    return res.status(400).json({
      success: false,
      message: `Insufficient stock. Available: ${batch.currentStock}.`
    });
  }

  const medicine = batch.medicine;
  const unitBuy = medicine?.buyingPrice || 0;
  const unitSell = medicine?.sellingPrice || 0;
  const totalCost = unitBuy * qty;
  const totalRevenue = unitSell * qty;
  const profit = totalRevenue - totalCost;

  // Create Transaction with rollback protection
  let transaction;
  try {
    transaction = await Transaction.create({
      pharmacyId: pharmacyDbId,
      medicineId: medicine?.id || medicine?._id,
      inventoryId: updatedBatch.id,
      type: "OUT",
      quantity: qty,
      unitBuyPrice: unitBuy,
      unitSellPrice: unitSell,
      totalCost,
      totalRevenue,
      profit,
      employeeId: verifiedStaff ? verifiedStaff.id : null,
      note: note || ""
    });
  } catch (err) {
    // Rollback inventory decrement if transaction record creation fails
    await Inventory.atomicIncrement(updatedBatch.id, pharmacyDbId, qty);
    throw err;
  }

  // Update staff total sales if valid employeeId provided
  if (verifiedStaff) {
    await Staff.incrementTotalSales(verifiedStaff.id, totalRevenue);
  }

  // Evaluate alerts after stock decrement
  await checkAlertsForBatch(updatedBatch.id);

  return res.status(201).json({
    success: true,
    message: "Sale completed successfully",
    data: {
      transactionId: transaction.id,
      remainingStock: updatedBatch.currentStock,
      totalRevenue,
      profit
    }
  });
});

/** List available stock batches for sale (currentStock > 0 & not expired). */
export const getAvailableStock = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const batches = await Inventory.findAvailableStock(pharmacyDbId);

  return res.json({
    success: true,
    data: batches
  });
});

/** List transactions history. */
export const getTransactions = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);

  const { total, rows } = await Transaction.findByPharmacyPaginated(pharmacyDbId, { page, limit });

  return res.json({
    success: true,
    data: rows,
    pagination: { total, page, pages: Math.ceil(total / limit) }
  });
});

/** Create a manual transaction record. */
export const createTransaction = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { medicine, medicineId, inventoryId, type, quantity, unitBuyPrice, unitSellPrice, employeeId, note } = req.body;

  const targetMedicineId = medicineId || medicine;
  if (!targetMedicineId) {
    return res.status(400).json({ success: false, message: "Medicine ID is required." });
  }

  const med = await Medicine.findByIdAndPharmacy(targetMedicineId, pharmacyDbId);
  if (!med) {
    return res.status(404).json({ success: false, message: "Medicine not found." });
  }

  // Verify staff employee belongs to current pharmacy tenant
  let verifiedStaff = null;
  if (employeeId) {
    verifiedStaff = await Staff.findByIdAndPharmacy(employeeId, pharmacyDbId);
    if (!verifiedStaff) {
      return res.status(400).json({
        success: false,
        message: "Invalid or unauthorized employee ID for this pharmacy workspace."
      });
    }
  }

  const qty = Number(quantity);
  const buy = unitBuyPrice !== undefined ? Number(unitBuyPrice) : (med.buyingPrice || 0);
  const sell = unitSellPrice !== undefined ? Number(unitSellPrice) : (med.sellingPrice || 0);
  const totalCost = buy * qty;
  const totalRevenue = sell * qty;
  const profit = totalRevenue - totalCost;

  // If inventoryId is provided, verify ownership and reconcile stock
  let batchDoc = null;
  if (inventoryId) {
    batchDoc = await Inventory.findByIdAndPharmacy(inventoryId, pharmacyDbId);
    if (!batchDoc) {
      return res.status(404).json({ success: false, message: "Inventory batch not found in this pharmacy." });
    }

    if (type === "OUT") {
      const updated = await Inventory.atomicDecrement(inventoryId, pharmacyDbId, qty);
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock in batch. Available: ${batchDoc.currentStock}.`
        });
      }
      await checkAlertsForBatch(updated.id);
    } else if (type === "IN") {
      const updated = await Inventory.atomicIncrement(inventoryId, pharmacyDbId, qty);
      await checkAlertsForBatch(updated.id);
    }
  }

  let transaction;
  try {
    transaction = await Transaction.create({
      pharmacyId: pharmacyDbId,
      medicineId: med.id,
      inventoryId: batchDoc ? batchDoc.id : null,
      type,
      quantity: qty,
      unitBuyPrice: buy,
      unitSellPrice: sell,
      totalCost,
      totalRevenue,
      profit,
      employeeId: verifiedStaff ? verifiedStaff.id : null,
      note: note || ""
    });
  } catch (err) {
    if (batchDoc) {
      if (type === "OUT") {
        await Inventory.atomicIncrement(batchDoc.id, pharmacyDbId, qty);
      } else if (type === "IN") {
        await Inventory.atomicDecrement(batchDoc.id, pharmacyDbId, qty);
      }
    }
    throw err;
  }

  if (type === "OUT" && verifiedStaff) {
    await Staff.incrementTotalSales(verifiedStaff.id, totalRevenue);
  }

  return res.status(201).json({
    success: true,
    data: transaction
  });
});

/** Update transaction record. */
export const updateTransaction = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const transaction = await Transaction.findByIdAndPharmacy(req.params.id, pharmacyDbId);

  if (!transaction) {
    return res.status(404).json({ success: false, message: "Transaction not found" });
  }

  const updates = {};
  const { medicine, medicineId, quantity, type, unitBuyPrice, unitSellPrice, note } = req.body;

  if (medicineId || medicine) {
    const med = await Medicine.findByIdAndPharmacy(medicineId || medicine, pharmacyDbId);
    if (med) updates.medicineId = med.id;
  }
  if (quantity !== undefined) updates.quantity = Number(quantity);
  if (type !== undefined) updates.type = type;
  if (unitBuyPrice !== undefined) updates.unitBuyPrice = Number(unitBuyPrice);
  if (unitSellPrice !== undefined) updates.unitSellPrice = Number(unitSellPrice);
  if (note !== undefined) updates.note = note;

  // Recalculate financials
  const finalQty = updates.quantity ?? transaction.quantity;
  const finalBuy = updates.unitBuyPrice ?? transaction.unitBuyPrice;
  const finalSell = updates.unitSellPrice ?? transaction.unitSellPrice;
  updates.totalCost = finalBuy * finalQty;
  updates.totalRevenue = finalSell * finalQty;
  updates.profit = updates.totalRevenue - updates.totalCost;

  await Transaction.updateById(transaction.id, updates);
  const updated = await Transaction.findById(transaction.id);

  return res.json({
    success: true,
    data: updated
  });
});

/** Delete transaction record. */
export const deleteTransaction = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const transaction = await Transaction.findByIdAndPharmacy(req.params.id, pharmacyDbId);

  if (!transaction) {
    return res.status(404).json({ success: false, message: "Transaction not found" });
  }

  await Transaction.deleteByIdAndPharmacy(req.params.id, pharmacyDbId);

  return res.json({ success: true, message: "Transaction deleted successfully" });
});

// Named aliases for route compatibility
export const listMedicines = getMedicines;
export const listInventory = getInventory;
export const createInventoryBatch = createInventory;
export const updateInventoryBatch = updateInventory;
export const deleteInventoryBatch = deleteInventory;
export const listAvailableStock = getAvailableStock;
export const listTransactions = getTransactions;
