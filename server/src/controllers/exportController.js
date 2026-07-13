import Inventory from "../models/Inventory.js";
import Transaction from "../models/Transaction.js";

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
export const exportTransactionsCsv = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("medicine")
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
      tx.medicine?.name || "",
      tx.medicine?.brand || "",
      tx.quantity,
      tx.unitBuyPrice,
      tx.unitSellPrice,
      tx.totalCost,
      tx.totalRevenue,
      tx.profit,
      tx.note || ""
    ]);

    const csv = toCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="all-transactions.csv"');
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/** Download current stock snapshot as CSV. */
export const exportStockCsv = async (req, res) => {
  try {
    const batches = await Inventory.find().populate("medicine").sort({ createdAt: -1 });

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
      const buy = b.medicine?.buyingPrice || 0;
      return [
        b.medicine?.name || "",
        b.medicine?.brand || "",
        b.medicine?.description || "",
        b.batchNumber,
        b.currentStock,
        b.reorderLevel,
        new Date(b.expiryDate).toISOString().split("T")[0],
        buy,
        b.medicine?.sellingPrice || 0,
        buy * b.currentStock
      ];
    });

    const csv = toCsv(headers, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="current-stock.csv"');
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
