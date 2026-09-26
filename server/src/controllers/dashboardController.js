import { Inventory, Transaction } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const formatBatch = (b) => {
  if (!b) return null;
  return {
    _id: b._id,
    id: b._id,
    medicineName: b.medicineId?.name || "Unknown",
    brand: b.medicineId?.brand || "",
    batchNumber: b.batchNumber,
    currentStock: b.currentStock,
    reorderLevel: b.reorderLevel,
    expiryDate: b.expiryDate,
    buyingPrice: b.medicineId?.buyingPrice || 0,
    sellingPrice: b.medicineId?.sellingPrice || 0
  };
};

/** Dashboard KPIs, expiry lists, and low-stock items for the home page. */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const monthStart = startOfMonth();
  const now = new Date();
  const inTenDays = new Date();
  inTenDays.setDate(inTenDays.getDate() + 10);

  const [expiredCount, expiringSoonCount, lowStockCount, profitAgg] = await Promise.all([
    Inventory.countDocuments({
      pharmacyId: pharmacyDbId,
      expiryDate: { $lt: now }
    }),
    Inventory.countDocuments({
      pharmacyId: pharmacyDbId,
      expiryDate: { $gte: now, $lte: inTenDays }
    }),
    Inventory.countDocuments({
      pharmacyId: pharmacyDbId,
      currentStock: { $gt: 0 },
      $expr: { $lte: ["$currentStock", "$reorderLevel"] }
    }),
    Transaction.aggregate([
      {
        $match: {
          pharmacyId: pharmacyDbId,
          type: "OUT",
          createdAt: { $gte: monthStart }
        }
      },
      {
        $group: {
          _id: null,
          profit: { $sum: "$profit" }
        }
      }
    ])
  ]);

  const profitThisMonth = profitAgg.length > 0 ? profitAgg[0].profit : 0;

  let expiryPanelRows = [];
  let expiryPanelTitle = "Expiring Soon (10 days)";

  if (expiredCount > 0) {
    expiryPanelTitle = "Expired Stock";
    expiryPanelRows = await Inventory.find({
      pharmacyId: pharmacyDbId,
      expiryDate: { $lt: now }
    })
      .populate("medicineId")
      .sort({ expiryDate: 1 })
      .limit(10);
  } else {
    expiryPanelRows = await Inventory.find({
      pharmacyId: pharmacyDbId,
      expiryDate: { $gte: now, $lte: inTenDays }
    })
      .populate("medicineId")
      .sort({ expiryDate: 1 })
      .limit(10);
  }

  const lowStockItemsRows = await Inventory.find({
    pharmacyId: pharmacyDbId,
    currentStock: { $gt: 0 },
    $expr: { $lte: ["$currentStock", "$reorderLevel"] }
  })
    .populate("medicineId")
    .sort({ currentStock: 1 })
    .limit(10);

  return res.json({
    success: true,
    data: {
      expiredCount,
      expiringSoonCount,
      lowStockCount,
      profitThisMonth,
      expiryPanelTitle,
      expiryPanel: expiryPanelRows.map(formatBatch),
      lowStockItems: lowStockItemsRows.map(formatBatch)
    }
  });
});
