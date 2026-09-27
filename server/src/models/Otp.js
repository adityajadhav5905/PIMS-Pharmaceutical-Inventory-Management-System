import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    hashedOtp: {
      type: String,
      required: true
    },
    purpose: {
      type: String,
      required: true,
      enum: [
        "PHARMACY_REGISTRATION",
        "STAFF_CREATE",
        "STAFF_UPDATE",
        "STAFF_DELETE",
        "CHANGE_NAME",
        "CHANGE_PASSWORD",
        "STAFF_MUTATION",
        "SETTINGS_UPDATE"
      ],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      default: null,
      index: true
    },
    targetEntityId: {
      type: String,
      default: null,
      index: true
    },
    targetPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    verified: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // MongoDB TTL index to automatically purge expired records
    }
  },
  {
    timestamps: true
  }
);

export const Otp = mongoose.model("Otp", otpSchema);
export default Otp;
