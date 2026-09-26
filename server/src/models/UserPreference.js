import mongoose from "mongoose";

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    inventoryAlerts: {
      type: Boolean,
      default: true
    },
    weeklyReports: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export const UserPreference = mongoose.model("UserPreference", userPreferenceSchema);
