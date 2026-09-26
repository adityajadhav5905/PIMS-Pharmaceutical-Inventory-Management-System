import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
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
    predictionDate: {
      type: Date,
      default: Date.now
    },
    predictedDemand: {
      type: [Number],
      required: true
    },
    confidence: {
      type: Number,
      default: 0.8
    },
    source: {
      type: String,
      default: "Time-Series Moving Average (ML Service)"
    }
  },
  {
    timestamps: true
  }
);

predictionSchema.index({ pharmacyId: 1, medicineId: 1 }, { unique: true });

export const Prediction = mongoose.model("Prediction", predictionSchema);
