import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" },
    predictedDemand: [{ type: Number }],
    confidence: Number,
    source: { type: String, default: "ml-service" }
  },
  { timestamps: true }
);

export default mongoose.model("Prediction", predictionSchema);
