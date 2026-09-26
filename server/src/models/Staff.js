import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: ""
    },
    position: {
      type: String,
      default: "Pharmacist"
    },
    department: {
      type: String,
      default: "Dispensing"
    },
    salary: {
      type: Number,
      default: 0
    },
    joinDate: {
      type: Date,
      default: Date.now
    },
    totalSales: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active"
    }
  },
  {
    timestamps: true
  }
);

export const Staff = mongoose.model("Staff", staffSchema);
