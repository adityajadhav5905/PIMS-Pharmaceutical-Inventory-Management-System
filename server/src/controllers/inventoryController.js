import { Medicine, Inventory, Transaction, Staff } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkAlertsForBatch } from "../jobs/alertJob.js";

/** List all medicine catalog items. */
export const getMedicines = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const medicines = await Medicine.find({ pharmacyId: pharmacyDbId, isActive: true }).sort({ name: 1 });

  return res.json({
    success: true,
    data: medicines.map((m) => ({
      _id: m._id,
      id: m._id,
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
  const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: pharmacyDbId });

  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found" });
  }

  return res.json({
    success: true,
    data: {
      _id: medicine._id,
      id: medicine._id,
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

  const existing = await Medicine.findOne({ pharmacyId: pharmacyDbId, sku });
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
      _id: medicine._id,
      id: medicine._id,
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
  const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: pharmacyDbId });

  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found" });
  }

  const fields = ["name", "sku", "brand", "description", "category", "supplier", "buyingPrice", "sellingPrice", "leadTimeDays"];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      medicine[f] = f.includes("Price") || f.includes("leadTime") ? Number(req.body[f]) : req.body[f];
    }
  }

  await medicine.save();

  return res.json({
    success: true,
    data: {
      _id: medicine._id,
      id: medicine._id,
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

/** Delete medicine catalog item (checks if referenced by inventory). */
export const deleteMedicine = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const batches = await Inventory.find({ medicineId: req.params.id, pharmacyId: pharmacyDbId });

  if (batches.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete medicine that is referenced by active inventory batches. Delete batches first."
    });
  }

  const medicine = await Medicine.findOneAndDelete({ _id: req.params.id, pharmacyId: pharmacyDbId });
  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found" });
  }

  return res.json({ success: true, message: "Medicine deleted successfully" });
});

/** Helper to resolve or upsert medicine during batch creation. */
const resolveMedicineId = async (payload, pharmacyDbId) => {
  if (payload.medicine) {
    const med = await Medicine.findOne({ _id: payload.medicine, pharmacyId: pharmacyDbId });
    if (med) {
      if (payload.category !== undefined) {
        med.category = payload.category;
        await med.save();
      }
      return med._id;
    }
  }

  const name = (payload.name || payload.medicine || "").trim();
  if (!name) throw new Error("Medicine name is required");

  let med = await Medicine.findOne({ pharmacyId: pharmacyDbId, name: new RegExp(`^${name}$`, "i") });
  if (med) {
    if (payload.brand !== undefined) med.brand = payload.brand;
    if (payload.description !== undefined) med.description = payload.description;
    if (payload.category !== undefined) med.category = payload.category;
    if (payload.buyingPrice !== undefined) med.buyingPrice = Number(payload.buyingPrice);
    if (payload.sellingPrice !== undefined) med.sellingPrice = Number(payload.sellingPrice);
    await med.save();
    return med._id;
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

  return med._id;
};

/** List inventory batches with search and pagination. */
export const getInventory = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const search = req.query.search || "";

  let matchQuery = { pharmacyId: pharmacyDbId };

  if (search) {
    const matchingMeds = await Medicine.find({
      pharmacyId: pharmacyDbId,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ]
    }).select("_id");

    const medIds = matchingMeds.map((m) => m._id);
    matchQuery.$or = [
      { medicineId: { $in: medIds } },
      { batchNumber: { $regex: search, $options: "i" } }
    ];
  }

  const total = await Inventory.countDocuments(matchQuery);
  const batches = await Inventory.find(matchQuery)
    .populate("medicineId")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const formatted = batches.map((b) => ({
    _id: b._id,
    id: b._id,
    batchNumber: b.batchNumber,
    currentStock: b.currentStock,
    reorderLevel: b.reorderLevel,
    expiryDate: b.expiryDate,
    createdAt: b.createdAt,
    medicine: b.medicineId ? {
      _id: b.medicineId._id,
      id: b.medicineId._id,
      name: b.medicineId.name,
      brand: b.medicineId.brand,
      category: b.medicineId.category || "",
      description: b.medicineId.description,
      buyingPrice: b.medicineId.buyingPrice,
      sellingPrice: b.medicineId.sellingPrice
    } : null
  }));

  return res.json({
    success: true,
    data: formatted,
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
      inventoryId: batch._id,
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
  await checkAlertsForBatch(batch._id);

  return res.status(201).json({
    success: true,
    data: {
      _id: batch._id,
      id: batch._id,
      batchNumber: batch.batchNumber,
      currentStock: batch.currentStock,
      reorderLevel: batch.reorderLevel,
      expiryDate: batch.expiryDate,
      medicine: medicine ? {
        _id: medicine._id,
        id: medicine._id,
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
  const batch = await Inventory.findOne({ _id: req.params.id, pharmacyId: pharmacyDbId });

  if (!batch) {
    return res.status(404).json({ success: false, message: "Inventory batch not found" });
  }

  const { batchNumber, currentStock, reorderLevel, expiryDate } = req.body;
  if (batchNumber !== undefined) batch.batchNumber = batchNumber;
  if (currentStock !== undefined) batch.currentStock = Number(currentStock);
  if (reorderLevel !== undefined) batch.reorderLevel = Number(reorderLevel);
  if (expiryDate !== undefined) batch.expiryDate = new Date(expiryDate);

  await batch.save();
  await checkAlertsForBatch(batch._id);

  return res.json({
    success: true,
    data: {
      _id: batch._id,
      id: batch._id,
      batchNumber: batch.batchNumber,
      currentStock: batch.currentStock,
      reorderLevel: batch.reorderLevel,
      expiryDate: batch.expiryDate
    }
  });
});

/** Delete inventory batch. */
export const deleteInventory = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const batch = await Inventory.findOneAndDelete({ _id: req.params.id, pharmacyId: pharmacyDbId });

  if (!batch) {
    return res.status(404).json({ success: false, message: "Inventory batch not found" });
  }

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

  const batch = await Inventory.findOne({ _id: inventoryId, pharmacyId: pharmacyDbId }).populate("medicineId");
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
    verifiedStaff = await Staff.findOne({ _id: employeeId, pharmacyId: pharmacyDbId });
    if (!verifiedStaff) {
      return res.status(400).json({
        success: false,
        message: "Invalid or unauthorized employee ID for this pharmacy workspace."
      });
    }
  }

  // Atomic decrement: only succeed if currentStock >= qty
  const updatedBatch = await Inventory.findOneAndUpdate(
    {
      _id: inventoryId,
      pharmacyId: pharmacyDbId,
      currentStock: { $gte: qty }
    },
    {
      $inc: { currentStock: -qty }
    },
    { new: true }
  );

  if (!updatedBatch) {
    return res.status(400).json({
      success: false,
      message: `Insufficient stock. Available: ${batch.currentStock}.`
    });
  }

  const medicine = batch.medicineId;
  const unitBuy = medicine?.buyingPrice || 0;
  const unitSell = medicine?.sellingPrice || 0;
  const totalCost = unitBuy * qty;
  const totalRevenue = unitSell * qty;
  const profit = totalRevenue - totalCost;

  // Create Transaction
  const transaction = await Transaction.create({
    pharmacyId: pharmacyDbId,
    medicineId: medicine?._id,
    inventoryId: updatedBatch._id,
    type: "OUT",
    quantity: qty,
    unitBuyPrice: unitBuy,
    unitSellPrice: unitSell,
    totalCost,
    totalRevenue,
    profit,
    employeeId: verifiedStaff ? verifiedStaff._id : null,
    note: note || ""
  });

  // Update staff total sales if valid employeeId provided
  if (verifiedStaff) {
    await Staff.findByIdAndUpdate(verifiedStaff._id, { $inc: { totalSales: totalRevenue } });
  }

  // Evaluate alerts after stock decrement
  await checkAlertsForBatch(updatedBatch._id);

  return res.status(201).json({
    success: true,
    message: "Sale completed successfully",
    data: {
      transactionId: transaction._id,
      remainingStock: updatedBatch.currentStock,
      totalRevenue,
      profit
    }
  });
});

/** List available stock batches for sale (currentStock > 0 & not expired). */
export const getAvailableStock = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const batches = await Inventory.find({
    pharmacyId: pharmacyDbId,
    currentStock: { $gt: 0 },
    expiryDate: { $gte: new Date() }
  }).populate("medicineId").sort({ expiryDate: 1 });

  return res.json({
    success: true,
    data: batches.map((b) => ({
      _id: b._id,
      id: b._id,
      batchNumber: b.batchNumber,
      currentStock: b.currentStock,
      expiryDate: b.expiryDate,
      medicine: b.medicineId ? {
        _id: b.medicineId._id,
        id: b.medicineId._id,
        name: b.medicineId.name,
        brand: b.medicineId.brand,
        sellingPrice: b.medicineId.sellingPrice
      } : null
    }))
  });
});

/** List transactions history. */
export const getTransactions = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);

  const total = await Transaction.countDocuments({ pharmacyId: pharmacyDbId });
  const transactions = await Transaction.find({ pharmacyId: pharmacyDbId })
    .populate("medicineId")
    .populate("employeeId")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return res.json({
    success: true,
    data: transactions.map((t) => ({
      _id: t._id,
      id: t._id,
      type: t.type,
      quantity: t.quantity,
      unitBuyPrice: t.unitBuyPrice,
      unitSellPrice: t.unitSellPrice,
      totalCost: t.totalCost,
      totalRevenue: t.totalRevenue,
      profit: t.profit,
      note: t.note,
      createdAt: t.createdAt,
      medicine: t.medicineId ? {
        _id: t.medicineId._id,
        name: t.medicineId.name,
        brand: t.medicineId.brand
      } : null,
      employee: t.employeeId ? {
        _id: t.employeeId._id,
        name: t.employeeId.name
      } : null
    })),
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

  const med = await Medicine.findOne({ _id: targetMedicineId, pharmacyId: pharmacyDbId });
  if (!med) {
    return res.status(404).json({ success: false, message: "Medicine not found." });
  }

  // Verify staff employee belongs to current pharmacy tenant
  let verifiedStaff = null;
  if (employeeId) {
    verifiedStaff = await Staff.findOne({ _id: employeeId, pharmacyId: pharmacyDbId });
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
    batchDoc = await Inventory.findOne({ _id: inventoryId, pharmacyId: pharmacyDbId });
    if (!batchDoc) {
      return res.status(404).json({ success: false, message: "Inventory batch not found in this pharmacy." });
    }

    if (type === "OUT") {
      const updated = await Inventory.findOneAndUpdate(
        { _id: inventoryId, pharmacyId: pharmacyDbId, currentStock: { $gte: qty } },
        { $inc: { currentStock: -qty } },
        { returnDocument: "after" }
      );
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock in batch. Available: ${batchDoc.currentStock}.`
        });
      }
      await checkAlertsForBatch(updated._id);
    } else if (type === "IN") {
      const updated = await Inventory.findOneAndUpdate(
        { _id: inventoryId, pharmacyId: pharmacyDbId },
        { $inc: { currentStock: qty } },
        { returnDocument: "after" }
      );
      await checkAlertsForBatch(updated._id);
    }
  }

  const transaction = await Transaction.create({
    pharmacyId: pharmacyDbId,
    medicineId: med._id,
    inventoryId: batchDoc ? batchDoc._id : null,
    type,
    quantity: qty,
    unitBuyPrice: buy,
    unitSellPrice: sell,
    totalCost,
    totalRevenue,
    profit,
    employeeId: verifiedStaff ? verifiedStaff._id : null,
    note: note || ""
  });

  if (type === "OUT" && verifiedStaff) {
    await Staff.findByIdAndUpdate(verifiedStaff._id, { $inc: { totalSales: totalRevenue } });
  }

  return res.status(201).json({
    success: true,
    data: transaction
  });
});

/** Update transaction record. */
export const updateTransaction = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const transaction = await Transaction.findOne({ _id: req.params.id, pharmacyId: pharmacyDbId });

  if (!transaction) {
    return res.status(404).json({ success: false, message: "Transaction not found" });
  }

  const { medicine, medicineId, quantity, type, unitBuyPrice, unitSellPrice, note } = req.body;

  if (medicineId || medicine) {
    const med = await Medicine.findOne({ _id: medicineId || medicine, pharmacyId: pharmacyDbId });
    if (med) transaction.medicineId = med._id;
  }
  if (quantity !== undefined) transaction.quantity = Number(quantity);
  if (type !== undefined) transaction.type = type;
  if (unitBuyPrice !== undefined) transaction.unitBuyPrice = Number(unitBuyPrice);
  if (unitSellPrice !== undefined) transaction.unitSellPrice = Number(unitSellPrice);
  if (note !== undefined) transaction.note = note;

  transaction.totalCost = transaction.unitBuyPrice * transaction.quantity;
  transaction.totalRevenue = transaction.unitSellPrice * transaction.quantity;
  transaction.profit = transaction.totalRevenue - transaction.totalCost;

  await transaction.save();

  return res.json({
    success: true,
    data: transaction
  });
});

/** Delete transaction record. */
export const deleteTransaction = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, pharmacyId: pharmacyDbId });

  if (!transaction) {
    return res.status(404).json({ success: false, message: "Transaction not found" });
  }

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
