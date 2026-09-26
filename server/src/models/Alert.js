import mongoose from "mongoose";

const alertSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null,
      index: true
    },
    type: {
      type: String,
      enum: ["LOW_STOCK", "OVERSTOCK", "EXPIRY_WARNING", "EXPIRED"],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium"
    },
    isResolved: {
      type: Boolean,
      default: false,
      index: true
    },
    closedAt: {
      type: Date,
      default: null
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

alertSchema.index({ pharmacyId: 1, inventoryId: 1, type: 1, isResolved: 1 });

export const Alert = mongoose.model("Alert", alertSchema);
