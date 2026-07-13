import Inventory from "../models/Inventory.js";
import Transaction from "../models/Transaction.js";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/** Dashboard KPIs, expiry lists, and low-stock items for the home page. */
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const inTenDays = new Date(now);
    inTenDays.setDate(inTenDays.getDate() + 10);

    const allBatches = await Inventory.find()
      .populate("medicine")
      .sort({ expiryDate: 1 });

    const expired = allBatches.filter((b) => endOfDay(b.expiryDate) < now);
    const expiringSoon = allBatches.filter(
      (b) => endOfDay(b.expiryDate) >= now && b.expiryDate <= inTenDays
    );
    const lowStock = allBatches.filter(
      (b) => b.currentStock > 0 && b.currentStock <= b.reorderLevel
    );

    const monthStart = startOfMonth();
    const salesThisMonth = await Transaction.find({
      type: "OUT",
      createdAt: { $gte: monthStart }
    });
    const profitThisMonth = salesThisMonth.reduce((sum, tx) => sum + (tx.profit || 0), 0);

    const expiryPanel = expired.length > 0 ? expired : expiringSoon;
    const expiryPanelTitle = expired.length > 0 ? "Expired Stock" : "Expiring Soon (10 days)";

    return res.json({
      success: true,
      data: {
        expiredCount: expired.length,
        expiringSoonCount: expiringSoon.length,
        lowStockCount: lowStock.length,
        profitThisMonth,
        expiryPanelTitle,
        expiryPanel: expiryPanel.slice(0, 10).map(formatBatch),
        lowStockItems: lowStock.slice(0, 10).map(formatBatch)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

function formatBatch(batch) {
  return {
    _id: batch._id,
    medicineName: batch.medicine?.name || "Unknown",
    brand: batch.medicine?.brand || "",
    batchNumber: batch.batchNumber,
    currentStock: batch.currentStock,
    reorderLevel: batch.reorderLevel,
    expiryDate: batch.expiryDate,
    buyingPrice: batch.medicine?.buyingPrice || 0,
    sellingPrice: batch.medicine?.sellingPrice || 0
  };
}
