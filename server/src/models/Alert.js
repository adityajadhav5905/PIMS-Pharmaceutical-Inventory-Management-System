import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    inventory: { type: mongoose.Schema.Types.ObjectId, ref: "Inventory" },
    type: { type: String, enum: ["LOW_STOCK", "OVERSTOCK", "EXPIRY_WARNING"], required: true },
    message: { type: String, required: true },
    isResolved: { type: Boolean, default: false },
    severity: { type: String, enum: ["Low", "Medium", "High"], default: "Medium" },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("Alert", alertSchema);
