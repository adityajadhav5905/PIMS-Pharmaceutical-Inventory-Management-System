import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true
    },
    sku: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    brand: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default: ""
    },
    category: {
      type: String,
      default: "",
      index: true
    },
    supplier: {
      type: String,
      default: ""
    },
    buyingPrice: {
      type: Number,
      required: true,
      default: 0
    },
    sellingPrice: {
      type: Number,
      required: true,
      default: 0
    },
    leadTimeDays: {
      type: Number,
      default: 7
    },
    isActive: {
      type: Boolean,
      default: true
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

medicineSchema.index({ pharmacyId: 1, sku: 1 }, { unique: true });

export const Medicine = mongoose.model("Medicine", medicineSchema);
