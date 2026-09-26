import mongoose from "mongoose";

const pharmacySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      default: ""
    },
    phone: {
      type: String,
      default: ""
    },
    email: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

export const Pharmacy = mongoose.model("Pharmacy", pharmacySchema);
