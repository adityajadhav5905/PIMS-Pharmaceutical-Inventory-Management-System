import { Transaction, Inventory, Staff, Medicine } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/** Financial summary: total revenue, profit, costs, inventory value, monthly stats, margin analysis. */
export const getFinancialSummary = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Aggregate all-time transactions
  const txAgg = await Transaction.aggregateByType(pharmacyDbId);

  let totalRevenue = 0;
  let totalProfit = 0;
  let totalCost = 0;
  let salesCount = 0;

  txAgg.forEach((group) => {
    if (group.type === "OUT") {
      totalRevenue = Number(group.total_revenue) || 0;
      totalProfit = Number(group.total_profit) || 0;
      salesCount = Number(group.cnt) || 0;
    } else if (group.type === "IN") {
      totalCost = Number(group.total_cost) || 0;
    }
  });

  // Aggregate current month transactions
  const monthTxAgg = await Transaction.aggregateMonthOutSales(pharmacyDbId, startOfCurrentMonth);
  const monthRevenue = monthTxAgg ? Number(monthTxAgg.month_revenue) || 0 : 0;
  const monthProfit = monthTxAgg ? Number(monthTxAgg.month_profit) || 0 : 0;
  const monthSalesCount = monthTxAgg ? Number(monthTxAgg.month_sales_count) || 0 : 0;

  // Calculate current stock inventory value
  const inventoryValue = await Inventory.getStockValue(pharmacyDbId);

  // Monthly trend for last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const monthlyTrends = await Transaction.aggregateMonthlyTrends(pharmacyDbId, sixMonthsAgo);

  // Calculate Highest and Lowest Margin Items from Medicine catalog
  const medicines = await Medicine.findActiveByPharmacy(pharmacyDbId);
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
  const recentSalesTx = await Transaction.findOutByPharmacy(pharmacyDbId);

  const recentSales = recentSalesTx.map((s) => ({
    _id: s.id,
    id: s.id,
    createdAt: s.created_at,
    medicineName: s.med_name || "Unknown",
    quantity: s.quantity,
    totalRevenue: Number(s.total_revenue),
    totalCost: Number(s.total_cost),
    profit: Number(s.profit)
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
        month: `${t.yr}-${String(t.mo).padStart(2, "0")}`,
        revenue: Number(t.revenue) || 0,
        profit: Number(t.profit) || 0
      }))
    }
  });
});

/** Employee sales performance breakdown. */
export const getEmployeePerformance = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();

  const performance = await Transaction.aggregateEmployeePerformance(pharmacyDbId);
  const activeStaff = await Staff.findActiveByPharmacy(pharmacyDbId);
  const perfMap = new Map();
  performance.forEach((p) => perfMap.set(String(p.employee_id), p));

  const result = activeStaff.map((s) => {
    const p = perfMap.get(String(s.id || s._id));
    return {
      _id: s._id,
      id: s._id,
      name: s.name,
      email: s.email,
      position: s.position,
      department: s.department,
      salesCount: p ? Number(p.transaction_count) || 0 : 0,
      totalRevenue: p ? Number(p.total_sales) || 0 : 0,
      totalProfit: p ? Number(p.total_profit) || 0 : 0
    };
  });

  return res.json({ success: true, data: result });
});
