import mongoose from "mongoose";

/** Medicine master record — name, brand, pricing used for profit on sales. */
const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    sku: { type: String, required: true, unique: true },
    brand: { type: String, default: "" },
    description: { type: String, default: "" },
    category: String,
    supplier: String,
    buyingPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    leadTimeDays: { type: Number, default: 7 }
  },
  { timestamps: true }
);

export default mongoose.model("Medicine", medicineSchema);
