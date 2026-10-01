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

  const transactions = await Transaction.findByPharmacy(pharmacyDbId);

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
    new Date(tx.created_at).toISOString(),
    tx.type,
    tx.med_name || "",
    tx.med_brand || "",
    tx.quantity,
    Number(tx.unit_buy_price),
    Number(tx.unit_sell_price),
    Number(tx.total_cost),
    Number(tx.total_revenue),
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

  const batches = await Inventory.findAllWithMedicine(pharmacyDbId);

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
    const buy = Number(b.medicine?.buyingPrice || b.buyingPrice) || 0;
    const sell = Number(b.medicine?.sellingPrice || b.sellingPrice) || 0;
    const expiryString = b.expiryDate ? new Date(b.expiryDate).toISOString().split("T")[0] : "";
    return [
      b.medicine?.name || b.medicineName || "",
      b.medicine?.brand || b.brand || "",
      b.medicine?.description || "",
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

  const performance = await Transaction.aggregateEmployeePerformance(pharmacyDbId);
  const activeStaff = await Staff.findActiveByPharmacy(pharmacyDbId);
  const perfMap = new Map();
  performance.forEach((p) => perfMap.set(String(p.employee_id), p));

  const rows = activeStaff.map((staff) => {
    const idStr = String(staff.id || staff._id);
    const p = perfMap.get(idStr);
    const salesCount = p ? Number(p.transaction_count) || 0 : 0;
    const totalRevenue = p ? Number(p.total_sales) || 0 : 0;
    const totalProfit = p ? Number(p.total_profit) || 0 : 0;

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
