import mongoose from "mongoose";

/** Stock movement — IN (purchase/restock) or OUT (sale). Financial fields set on OUT. */
const transactionSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    inventory: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
    quantity: { type: Number, required: true, min: 1 },
    type: { type: String, enum: ["IN", "OUT"], required: true },
    unitBuyPrice: { type: Number, default: 0 },
    unitSellPrice: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    note: String
  },
  { timestamps: true }
);

export default mongoose.model("Transaction", transactionSchema);
