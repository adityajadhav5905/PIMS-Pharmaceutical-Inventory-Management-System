import Transaction from "../models/Transaction.js";
import Medicine from "../models/Medicine.js";

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/** Financial summary — sales, costs, profit, margin leaders. */
export const getFinancialSummary = async (req, res) => {
  try {
    const monthStart = startOfMonth();

    const allSales = await Transaction.find({ type: "OUT" })
      .populate("medicine")
      .sort({ createdAt: -1 });

    const salesThisMonth = allSales.filter((tx) => tx.createdAt >= monthStart);

    const totalRevenue = allSales.reduce((s, tx) => s + (tx.totalRevenue || 0), 0);
    const totalCost = allSales.reduce((s, tx) => s + (tx.totalCost || 0), 0);
    const totalProfit = allSales.reduce((s, tx) => s + (tx.profit || 0), 0);

    const monthRevenue = salesThisMonth.reduce((s, tx) => s + (tx.totalRevenue || 0), 0);
    const monthCost = salesThisMonth.reduce((s, tx) => s + (tx.totalCost || 0), 0);
    const monthProfit = salesThisMonth.reduce((s, tx) => s + (tx.profit || 0), 0);

    const medicines = await Medicine.find({ sellingPrice: { $gt: 0 } });
    const marginItems = medicines
      .map((m) => {
        const margin = m.sellingPrice - m.buyingPrice;
        const marginPercent = m.buyingPrice > 0 ? (margin / m.buyingPrice) * 100 : 0;
        return {
          name: m.name,
          brand: m.brand,
          buyingPrice: m.buyingPrice,
          sellingPrice: m.sellingPrice,
          margin,
          marginPercent: Math.round(marginPercent * 100) / 100
        };
      })
      .filter((m) => m.sellingPrice > 0);

    const highestMarginItems = [...marginItems]
      .sort((a, b) => b.marginPercent - a.marginPercent)
      .slice(0, 5);
    const lowestMarginItems = [...marginItems]
      .sort((a, b) => a.marginPercent - b.marginPercent)
      .slice(0, 5);

    const recentSales = allSales.slice(0, 15).map((tx) => ({
      _id: tx._id,
      medicineName: tx.medicine?.name || "Unknown",
      quantity: tx.quantity,
      totalRevenue: tx.totalRevenue,
      totalCost: tx.totalCost,
      profit: tx.profit,
      createdAt: tx.createdAt
    }));

    return res.json({
      success: true,
      data: {
        totalRevenue,
        totalCost,
        totalProfit,
        monthRevenue,
        monthCost,
        monthProfit,
        totalSalesCount: allSales.length,
        monthSalesCount: salesThisMonth.length,
        highestMarginItems,
        lowestMarginItems,
        recentSales
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
