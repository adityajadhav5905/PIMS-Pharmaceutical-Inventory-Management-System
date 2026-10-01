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
    _id: b._id || b.id,
    id: b._id || b.id,
    medicineName: b.medicine?.name || b.medicineName || "Unknown",
    brand: b.medicine?.brand || b.brand || "",
    batchNumber: b.batchNumber,
    currentStock: b.currentStock,
    reorderLevel: b.reorderLevel,
    expiryDate: b.expiryDate,
    buyingPrice: b.medicine?.buyingPrice || b.buyingPrice || 0,
    sellingPrice: b.medicine?.sellingPrice || b.sellingPrice || 0
  };
};

/** Dashboard KPIs, expiry lists, and low-stock items for the home page. */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const monthStart = startOfMonth();

  const [expiredCount, expiringSoonCount, lowStockCount, profitThisMonth] = await Promise.all([
    Inventory.countExpired(pharmacyDbId),
    Inventory.countExpiringSoon(pharmacyDbId, 10),
    Inventory.countLowStock(pharmacyDbId),
    Transaction.aggregateMonthProfit(pharmacyDbId, monthStart)
  ]);

  let expiryPanelRows = [];
  let expiryPanelTitle = "Expiring Soon (10 days)";

  if (expiredCount > 0) {
    expiryPanelTitle = "Expired Stock";
    expiryPanelRows = await Inventory.findExpiredWithMedicine(pharmacyDbId, 10);
  } else {
    expiryPanelRows = await Inventory.findExpiringSoonWithMedicine(pharmacyDbId, 10, 10);
  }

  const lowStockItemsRows = await Inventory.findLowStockWithMedicine(pharmacyDbId, 10);

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
