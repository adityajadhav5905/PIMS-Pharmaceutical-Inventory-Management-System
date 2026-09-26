import { Transaction, Inventory, Staff, Medicine } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/** Financial summary: total revenue, profit, costs, inventory value, monthly stats, margin analysis. */
export const getFinancialSummary = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Aggregate all-time transactions
  const txAgg = await Transaction.aggregate([
    { $match: { pharmacyId: pharmacyDbId } },
    {
      $group: {
        _id: "$type",
        totalRevenue: { $sum: "$totalRevenue" },
        totalCost: { $sum: "$totalCost" },
        totalProfit: { $sum: "$profit" },
        count: { $sum: 1 }
      }
    }
  ]);

  let totalRevenue = 0;
  let totalProfit = 0;
  let totalCost = 0;
  let salesCount = 0;

  txAgg.forEach((group) => {
    if (group._id === "OUT") {
      totalRevenue = group.totalRevenue;
      totalProfit = group.totalProfit;
      salesCount = group.count;
    } else if (group._id === "IN") {
      totalCost = group.totalCost;
    }
  });

  // Aggregate current month transactions
  const monthTxAgg = await Transaction.aggregate([
    {
      $match: {
        pharmacyId: pharmacyDbId,
        type: "OUT",
        createdAt: { $gte: startOfCurrentMonth }
      }
    },
    {
      $group: {
        _id: null,
        monthRevenue: { $sum: "$totalRevenue" },
        monthProfit: { $sum: "$profit" },
        monthSalesCount: { $sum: 1 }
      }
    }
  ]);

  const monthRevenue = monthTxAgg.length > 0 ? monthTxAgg[0].monthRevenue : 0;
  const monthProfit = monthTxAgg.length > 0 ? monthTxAgg[0].monthProfit : 0;
  const monthSalesCount = monthTxAgg.length > 0 ? monthTxAgg[0].monthSalesCount : 0;

  // Calculate current stock inventory value
  const stockAgg = await Inventory.aggregate([
    { $match: { pharmacyId: pharmacyDbId, currentStock: { $gt: 0 } } },
    {
      $lookup: {
        from: "medicines",
        localField: "medicineId",
        foreignField: "_id",
        as: "medicine"
      }
    },
    { $unwind: "$medicine" },
    {
      $group: {
        _id: null,
        totalStockValue: {
          $sum: { $multiply: ["$currentStock", "$medicine.buyingPrice"] }
        }
      }
    }
  ]);

  const inventoryValue = stockAgg.length > 0 ? stockAgg[0].totalStockValue : 0;

  // Monthly trend for last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyTrends = await Transaction.aggregate([
    {
      $match: {
        pharmacyId: pharmacyDbId,
        type: "OUT",
        createdAt: { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        revenue: { $sum: "$totalRevenue" },
        profit: { $sum: "$profit" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  // Calculate Highest and Lowest Margin Items from Medicine catalog
  const medicines = await Medicine.find({ pharmacyId: pharmacyDbId, isActive: true }).select("name buyingPrice sellingPrice");
  const itemsWithMargin = medicines.map((m) => {
    const buy = Number(m.buyingPrice) || 0;
    const sell = Number(m.sellingPrice) || 0;
    const marginPercent = buy > 0 ? Math.round(((sell - buy) / buy) * 100) : (sell > 0 ? 100 : 0);
    return {
      name: m.name,
      buyingPrice: buy,
      sellingPrice: sell,
      marginPercent
    };
  });

  const highestMarginItems = [...itemsWithMargin]
    .sort((a, b) => b.marginPercent - a.marginPercent)
    .slice(0, 5);

  const lowestMarginItems = [...itemsWithMargin]
    .sort((a, b) => a.marginPercent - b.marginPercent)
    .slice(0, 5);

  // Fetch recent sales transactions for UI table
  const recentSalesTx = await Transaction.find({ pharmacyId: pharmacyDbId, type: "OUT" })
    .populate("medicineId", "name")
    .sort({ createdAt: -1 })
    .limit(10);

  const recentSales = recentSalesTx.map((s) => ({
    _id: s._id,
    id: s._id,
    createdAt: s.createdAt,
    medicineName: s.medicineId?.name || "Unknown",
    quantity: s.quantity,
    totalRevenue: s.totalRevenue,
    totalCost: s.totalCost,
    profit: s.profit
  }));

  return res.json({
    success: true,
    data: {
      totalRevenue,
      totalProfit,
      totalCost,
      inventoryValue,
      salesCount,
      totalSalesCount: salesCount,
      monthRevenue,
      monthProfit,
      monthSalesCount,
      highestMarginItems,
      topMarginItems: highestMarginItems,
      lowestMarginItems,
      recentSales,
      monthlyTrends: monthlyTrends.map((t) => ({
        month: `${t._id.year}-${String(t._id.month).padStart(2, "0")}`,
        revenue: t.revenue,
        profit: t.profit
      }))
    }
  });
});

/** Employee sales performance breakdown. */
export const getEmployeePerformance = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();

  const performance = await Transaction.aggregate([
    {
      $match: {
        pharmacyId: pharmacyDbId,
        type: "OUT",
        employeeId: { $ne: null }
      }
    },
    {
      $group: {
        _id: "$employeeId",
        salesCount: { $sum: 1 },
        totalRevenue: { $sum: "$totalRevenue" },
        totalProfit: { $sum: "$profit" }
      }
    }
  ]);

  const activeStaff = await Staff.find({ pharmacyId: pharmacyDbId, status: "Active" });
  const perfMap = new Map();
  performance.forEach((p) => perfMap.set(p._id.toString(), p));

  const result = activeStaff.map((s) => {
    const p = perfMap.get(s._id.toString());
    return {
      _id: s._id,
      id: s._id,
      name: s.name,
      email: s.email,
      position: s.position,
      department: s.department,
      salesCount: p ? p.salesCount : 0,
      totalRevenue: p ? p.totalRevenue : 0,
      totalProfit: p ? p.totalProfit : 0
    };
  });

  return res.json({ success: true, data: result });
});
