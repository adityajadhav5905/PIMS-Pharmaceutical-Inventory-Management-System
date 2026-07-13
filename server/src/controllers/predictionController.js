import Prediction from "../models/Prediction.js";
import Medicine from "../models/Medicine.js";
import Inventory from "../models/Inventory.js";
import { getPrediction } from "../services/mlService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Trigger an AI Demand Prediction for a specific medicine.
 * 
 * 1. Validates that the requested medicine exists in the database.
 * 2. Aggregates current stock level across all active batches in the inventory.
 * 3. Calls the ML service client (with robust statistical fallback if it's down).
 * 4. Calculates a safety stock recommendation based on predicted demand.
 * 5. Records the prediction history in MongoDB.
 * 6. Returns a structured dashboard-ready forecasting payload.
 */
export const runPrediction = asyncHandler(async (req, res) => {
  const medicineId = req.body.medicineId;

  // 1. Fetch medicine details
  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found" });
  }

  // 2. Query all inventory batches for this medicine and sum their current stock levels
  const batches = await Inventory.find({ medicine: medicineId });
  const currentStock = batches.reduce((sum, batch) => sum + (batch.currentStock || 0), 0);

  // 3. Request forecast from the ML Service helper (resilient fallback pattern)
  const mlResponse = await getPrediction({ medicine_id: medicineId });
  const predictedDemand = mlResponse.predicted_demand;
  const confidence = mlResponse.confidence;

  // 4. Calculate recommended stock using a 20% safety margin buffer (safety stock = demand * 1.2)
  const recommendedStock = Math.ceil(predictedDemand * 1.2);

  // 5. Store the prediction record in the database for tracking accuracy over time
  await Prediction.create({
    medicine: medicineId,
    predictedDemand: [predictedDemand],
    confidence: confidence,
    source: mlResponse.source || "ml-service"
  });

  // 6. Set projection date (30 days from now)
  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + 30);

  // 7. Send the complete prediction model response back to the React frontend
  return res.json({
    success: true,
    data: {
      medicine: medicine.name,
      currentStock,
      predictedDemand,
      recommendedStock,
      confidence,
      predictedDate: predictedDate.toLocaleDateString()
    }
  });
});

