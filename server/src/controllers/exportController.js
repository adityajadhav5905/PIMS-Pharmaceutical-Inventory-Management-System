import { Transaction, Inventory, Staff } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const toCsv = (headers, rows) => {
  const lines = [headers.join(",")];
  rows.forEach((row) => lines.push(row.map(csvEscape).join(",")));
  return lines.join("\n");
};

/** Download all sale/stock transactions as CSV. */
export const exportTransactionsCsv = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();

  const transactions = await Transaction.find({ pharmacyId: pharmacyDbId })
    .populate("medicineId")
    .sort({ createdAt: -1 });

  const headers = [
    "Date",
    "Type",
    "Medicine",
    "Brand",
    "Quantity",
    "Unit Buy Price (INR)",
    "Unit Sell Price (INR)",
    "Total Cost (INR)",
    "Total Revenue (INR)",
    "Profit (INR)",
    "Note"
  ];

  const rows = transactions.map((tx) => [
    new Date(tx.createdAt).toISOString(),
    tx.type,
    tx.medicineId?.name || "",
    tx.medicineId?.brand || "",
    tx.quantity,
    Number(tx.unitBuyPrice),
    Number(tx.unitSellPrice),
    Number(tx.totalCost),
    Number(tx.totalRevenue),
    Number(tx.profit),
    tx.note || ""
  ]);

  const csv = toCsv(headers, rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="all-transactions.csv"');
  return res.send(csv);
});

/** Download current stock snapshot as CSV. */
export const exportStockCsv = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();

  const batches = await Inventory.find({ pharmacyId: pharmacyDbId })
    .populate("medicineId")
    .sort({ createdAt: -1 });

  const headers = [
    "Medicine",
    "Brand",
    "Description",
    "Batch Number",
    "Current Stock",
    "Reorder Level",
    "Expiry Date",
    "Buying Price (INR)",
    "Selling Price (INR)",
    "Stock Value (INR)"
  ];

  const rows = batches.map((b) => {
    const buy = Number(b.medicineId?.buyingPrice) || 0;
    const sell = Number(b.medicineId?.sellingPrice) || 0;
    const expiryString = b.expiryDate ? new Date(b.expiryDate).toISOString().split("T")[0] : "";
    return [
      b.medicineId?.name || "",
      b.medicineId?.brand || "",
      b.medicineId?.description || "",
      b.batchNumber,
      b.currentStock,
      b.reorderLevel,
      expiryString,
      buy,
      sell,
      buy * b.currentStock
    ];
  });

  const csv = toCsv(headers, rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="current-stock.csv"');
  return res.send(csv);
});

/** Download employee sales performance as CSV. */
export const exportStaffPerformanceCsv = asyncHandler(async (req, res) => {
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

  const rows = activeStaff.map((staff) => {
    const idStr = staff._id.toString();
    const salesCount = perfMap.has(idStr) ? perfMap.get(idStr).salesCount : 0;
    const totalRevenue = perfMap.has(idStr) ? Number(perfMap.get(idStr).totalRevenue) : 0;
    const totalProfit = perfMap.has(idStr) ? Number(perfMap.get(idStr).totalProfit) : 0;

    return [
      staff.name,
      staff.email || "",
      staff.position,
      staff.department || "",
      staff.status,
      salesCount,
      totalRevenue,
      totalProfit
    ];
  });

  const headers = [
    "Name",
    "Email",
    "Position",
    "Department",
    "Status",
    "Sales Count",
    "Total Sales (INR)",
    "Total Profit (INR)"
  ];

  const csv = toCsv(headers, rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="employee-performance.csv"');
  return res.send(csv);
});
