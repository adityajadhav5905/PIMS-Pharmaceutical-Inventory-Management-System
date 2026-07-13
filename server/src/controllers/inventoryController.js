import Inventory from "../models/Inventory.js";
import Medicine from "../models/Medicine.js";
import Transaction from "../models/Transaction.js";
import Staff from "../models/Staff.js";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkAlertsForBatch } from "../jobs/alertJob.js";

/**
 * Helper function: Resolve a medicine by MongoDB ObjectId, OR find it by name, OR create a new Medicine document.
 * 
 * 1. If payload contains a valid 'medicine' ObjectId, verifies it exists and updates metadata if provided.
 * 2. If 'medicine' is not a valid ObjectId, searches by name (case-insensitive regular expression).
 * 3. If the medicine name is not found, creates a new Medicine record with a generated SKU.
 */
const resolveOrCreateMedicine = async (payload) => {
  if (payload.medicine && mongoose.Types.ObjectId.isValid(payload.medicine)) {
    const existing = await Medicine.findById(payload.medicine);
    if (!existing) throw new Error("Medicine not found");

    const updates = {};
    if (payload.brand !== undefined) updates.brand = payload.brand;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.buyingPrice !== undefined) updates.buyingPrice = payload.buyingPrice;
    if (payload.sellingPrice !== undefined) updates.sellingPrice = payload.sellingPrice;
    if (payload.name) updates.name = payload.name;

    if (Object.keys(updates).length) {
      Object.assign(existing, updates);
      await existing.save();
    }
    return existing._id;
  }

  const name = (payload.name || payload.medicine || "").trim();
  if (!name) throw new Error("Medicine name is required");

  // Perform case-insensitive name match to prevent creating duplicate medicines
  let medicine = await Medicine.findOne({
    name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
  });

  if (medicine) {
    if (payload.brand !== undefined) medicine.brand = payload.brand;
    if (payload.description !== undefined) medicine.description = payload.description;
    if (payload.buyingPrice !== undefined) medicine.buyingPrice = payload.buyingPrice;
    if (payload.sellingPrice !== undefined) medicine.sellingPrice = payload.sellingPrice;
    await medicine.save();
    return medicine._id;
  }

  // Create new medicine catalog entry if it doesn't exist
  medicine = await Medicine.create({
    name,
    sku: `MED-${Date.now()}`,
    brand: payload.brand || "",
    description: payload.description || "",
    buyingPrice: payload.buyingPrice || 0,
    sellingPrice: payload.sellingPrice || 0
  });

  return medicine._id;
};

/** Create a standalone Medicine record in the catalog. */
export const createMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.create(req.body);
  return res.status(201).json({ success: true, data: medicine });
});

/** List all medicine catalog items. */
export const listMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.find().sort({ name: 1 });
  return res.json({ success: true, data: medicines });
});

/** List inventory batches with search filters, sorting, and pagination. */
export const listInventory = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const search = req.query.search?.trim() || "";
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  // Search by medicine name or brand
  const medicineFilter = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { brand: { $regex: search, $options: "i" } }
        ]
      }
    : {};
  const medicineIds = search
    ? (await Medicine.find(medicineFilter).select("_id")).map((m) => m._id)
    : null;
  const filter = medicineIds ? { medicine: { $in: medicineIds } } : {};

  // Fetch paginated inventory rows and count total documents
  const [rows, total] = await Promise.all([
    Inventory.find(filter)
      .populate("medicine")
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit),
    Inventory.countDocuments(filter)
  ]);

  return res.json({
    success: true,
    data: rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

/** List inventory batches with stock level > 0 (used for the Sell page). */
export const listAvailableStock = asyncHandler(async (req, res) => {
  const rows = await Inventory.find({ currentStock: { $gt: 0 } })
    .populate("medicine")
    .sort({ expiryDate: 1 }); // Sort by expiryDate ascending (First-Expiring-First-Out strategy)
  return res.json({ success: true, data: rows });
});

/** Create an inventory batch and log a corresponding stock IN transaction. */
export const createInventoryBatch = asyncHandler(async (req, res) => {
  const medicineId = await resolveOrCreateMedicine(req.body);
  const row = await Inventory.create({
    medicine: medicineId,
    batchNumber: req.body.batchNumber,
    currentStock: req.body.currentStock,
    reorderLevel: req.body.reorderLevel ?? 20,
    expiryDate: req.body.expiryDate
  });

  const populated = await row.populate("medicine");

  // Automatically log a "Stock added" IN transaction
  await Transaction.create({
    medicine: medicineId,
    inventory: row._id,
    quantity: req.body.currentStock,
    type: "IN",
    unitBuyPrice: populated.medicine.buyingPrice,
    unitSellPrice: populated.medicine.sellingPrice,
    totalCost: populated.medicine.buyingPrice * req.body.currentStock,
    totalRevenue: 0,
    profit: 0,
    note: "Stock added"
  });

  // Instantly run stock/expiry checks to generate any immediate alerts if thresholds are pre-breached
  await checkAlertsForBatch(row._id);

  return res.status(201).json({ success: true, data: populated });
});

/** Update inventory batch details (stock level, reorder thresholds, or expiry dates). */
export const updateInventoryBatch = asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  delete updates.name;
  delete updates.brand;
  delete updates.description;
  delete updates.buyingPrice;
  delete updates.sellingPrice;

  const batch = await Inventory.findById(req.params.id).populate("medicine");
  if (!batch) return res.status(404).json({ success: false, message: "Inventory batch not found" });

  // Update associated medicine details if medicine-specific properties are modified
  if (req.body.name || req.body.brand || req.body.description || req.body.buyingPrice !== undefined || req.body.sellingPrice !== undefined) {
    await resolveOrCreateMedicine({
      medicine: batch.medicine._id,
      name: req.body.name,
      brand: req.body.brand,
      description: req.body.description,
      buyingPrice: req.body.buyingPrice,
      sellingPrice: req.body.sellingPrice
    });
  }

  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) delete updates[key];
  });

  const row = await Inventory.findByIdAndUpdate(req.params.id, updates, { new: true }).populate("medicine");

  // Instantly run stock/expiry checks to update alerts based on changes
  await checkAlertsForBatch(row._id);

  return res.json({ success: true, data: row });
});

/** Delete an inventory batch. */
export const deleteInventoryBatch = asyncHandler(async (req, res) => {
  const row = await Inventory.findByIdAndDelete(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: "Inventory batch not found" });
  return res.json({ success: true, message: "Inventory batch deleted" });
});

/**
 * Record a medicine sale.
 * 
 * 1. Checks that the selected batch exists and has enough stock.
 * 2. Deducts the stock from the inventory batch.
 * 3. Creates an OUT transaction, calculating buying cost, revenue, and profit.
 * 4. Finds the active Staff member matching the logged-in user's email and increments their totalSales.
 */
export const sellStock = asyncHandler(async (req, res) => {
  const batch = await Inventory.findById(req.body.inventoryId).populate("medicine");
  if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });

  const qty = Number(req.body.quantity);
  if (batch.currentStock < qty) {
    return res.status(400).json({
      success: false,
      message: `Insufficient stock. Available: ${batch.currentStock}`
    });
  }

  const buyPrice = batch.medicine.buyingPrice || 0;
  const sellPrice = batch.medicine.sellingPrice || 0;
  const totalCost = buyPrice * qty;
  const totalRevenue = sellPrice * qty;
  const profit = totalRevenue - totalCost;

  // Deduct stock
  batch.currentStock -= qty;
  await batch.save();

  // Create OUT transaction record
  const tx = await Transaction.create({
    medicine: batch.medicine._id,
    inventory: batch._id,
    quantity: qty,
    type: "OUT",
    unitBuyPrice: buyPrice,
    unitSellPrice: sellPrice,
    totalCost,
    totalRevenue,
    profit,
    note: req.body.note || "Sale"
  });

  // Update staff performance total sales if the logged-in user has a corresponding active staff profile
  if (req.user && req.user.email) {
    await Staff.findOneAndUpdate(
      { email: req.user.email, status: "Active" },
      { $inc: { totalSales: totalRevenue } }
    );
  }

  const populated = await tx.populate("medicine");

  // Instantly run stock/expiry checks to generate low-stock warnings immediately on sale
  await checkAlertsForBatch(batch._id);

  return res.status(201).json({
    success: true,
    data: {
      transaction: populated,
      remainingStock: batch.currentStock,
      profit
    }
  });
});

/** List and filter transactions with pagination. */
export const listTransactions = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const type = req.query.type || "";
  const search = req.query.search?.trim() || "";
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  const medicineFilter = search ? { name: { $regex: search, $options: "i" } } : {};
  const medicineIds = search ? (await Medicine.find(medicineFilter).select("_id")).map((m) => m._id) : null;
  const filter = {
    ...(type ? { type } : {}),
    ...(medicineIds ? { medicine: { $in: medicineIds } } : {})
  };

  const [rows, total] = await Promise.all([
    Transaction.find(filter)
      .populate("medicine")
      .sort({ [sortBy]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(filter)
  ]);

  return res.json({
    success: true,
    data: rows,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});

/** Create a standalone Transaction (direct ledger entry). */
export const createTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.create(req.body);
  return res.status(201).json({ success: true, data: tx });
});

/** Update an existing Transaction. */
export const updateTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });
  return res.json({ success: true, data: tx });
});

/** Delete a Transaction. */
export const deleteTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findByIdAndDelete(req.params.id);
  if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });
  return res.json({ success: true, message: "Transaction deleted" });
});

