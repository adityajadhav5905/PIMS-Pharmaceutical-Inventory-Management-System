import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    batchNumber: { type: String, required: true },
    currentStock: { type: Number, required: true, min: 0, index: true },
    reorderLevel: { type: Number, default: 20 },
    expiryDate: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", inventorySchema);
