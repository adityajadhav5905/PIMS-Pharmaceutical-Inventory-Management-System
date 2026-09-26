import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
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
      required: true
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      default: null
    },
    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitBuyPrice: {
      type: Number,
      default: 0
    },
    unitSellPrice: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    profit: {
      type: Number,
      default: 0
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null
    },
    note: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ pharmacyId: 1, createdAt: -1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
