import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
      index: true
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true
    },
    currentStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    reorderLevel: {
      type: Number,
      default: 20
    },
    expiryDate: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

inventorySchema.index({ pharmacyId: 1, medicineId: 1, batchNumber: 1 });

export const Inventory = mongoose.model("Inventory", inventorySchema);
