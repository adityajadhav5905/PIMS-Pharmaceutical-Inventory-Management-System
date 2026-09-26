import { Medicine, Inventory, Transaction, Alert, Prediction } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requestMlPrediction } from "../services/mlService.js";

/** Map generic/common category terms to standardized ATC codes */
const mapToAtcCategory = (categoryStr) => {
  if (!categoryStr) return "M01AB";
  const upper = categoryStr.toUpperCase().trim();
  const validAtc = ["M01AB", "M01AE", "N02BA", "N02BE", "N05B", "N05C", "R03", "R06"];
  if (validAtc.includes(upper)) return upper;

  if (upper.includes("ALLERG") || upper.includes("HISTAMINE") || upper.includes("CETIRIZ")) return "R06";
  if (upper.includes("INHAL") || upper.includes("AIRWAY") || upper.includes("RESPIRATORY") || upper.includes("SALBUTAMOL")) return "R03";
  if (upper.includes("PARACET") || upper.includes("ACETAMIN") || upper.includes("ANALGESIC") || upper.includes("FEVER")) return "N02BE";
  if (upper.includes("ASPIRIN") || upper.includes("SALICYL")) return "N02BA";
  if (upper.includes("IBUPROFEN") || upper.includes("PROPIONIC")) return "M01AE";
  if (upper.includes("INFLAMM") || upper.includes("ANTIBIOTIC") || upper.includes("DICLOFENAC") || upper.includes("AMOX")) return "M01AB";
  if (upper.includes("ANXIO") || upper.includes("DIAZEPAM") || upper.includes("METFORMIN")) return "N05B";
  if (upper.includes("SEDAT") || upper.includes("SLEEP") || upper.includes("HYPNOTIC") || upper.includes("STATIN")) return "N05C";

  return "M01AB";
};

/**
 * Calculate completed historical monthly sales baseline for a medicine in a pharmacy.
 * Rules:
 * 1. Strictly exclude current ongoing (incomplete) month.
 * 2. Strictly exclude future transactions (if any).
 * 3. If >= 3 completed months available: baseline = mean(last 3 completed months).
 * 4. If 1-2 completed months available: baseline = mean(available completed months).
 * 5. If 0 completed months available: baseline = default initial baseline (e.g. 100 units).
 */
export const calculatePharmacyBaseline = async (pharmacyDbId, medicineId, initialBaselineFallback = 100) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Query all completed OUT transactions for this medicine
  const transactions = await Transaction.find({
    pharmacyId: pharmacyDbId,
    medicineId,
    type: "OUT"
  }).sort({ createdAt: 1 });

  // Aggregate sales by calendar month (YYYY-MM)
  const monthlyTotals = new Map();

  for (const tx of transactions) {
    const txDate = new Date(tx.createdAt);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();

    // Exclude current incomplete month and future transactions
    if (txYear > currentYear || (txYear === currentYear && txMonth >= currentMonth)) {
      continue;
    }

    const key = `${txYear}-${String(txMonth + 1).padStart(2, "0")}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + (Number(tx.quantity) || 0));
  }

  const completedMonths = Array.from(monthlyTotals.keys()).sort();
  const completedCounts = completedMonths.map((m) => monthlyTotals.get(m));

  if (completedCounts.length >= 3) {
    const last3 = completedCounts.slice(-3);
    const avg = last3.reduce((a, b) => a + b, 0) / 3.0;
    return {
      baseline: Math.round(avg * 100) / 100,
      completedMonthsCount: completedCounts.length,
      baselineSource: "average_last_3_completed_months",
      completedMonthlyData: completedMonths.slice(-3).map((m, i) => ({ month: m, sales: last3[i] }))
    };
  } else if (completedCounts.length > 0) {
    const avg = completedCounts.reduce((a, b) => a + b, 0) / completedCounts.length;
    return {
      baseline: Math.round(avg * 100) / 100,
      completedMonthsCount: completedCounts.length,
      baselineSource: "average_available_completed_months",
      completedMonthlyData: completedMonths.map((m, i) => ({ month: m, sales: completedCounts[i] }))
    };
  } else {
    return {
      baseline: Number(initialBaselineFallback) || 100.0,
      completedMonthsCount: 0,
      baselineSource: "initial_pharmacy_baseline",
      completedMonthlyData: []
    };
  }
};

/**
 * Generate demand forecast for a medicine using ML service or fallback.
 */
export const runPrediction = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const medicineId = req.body.medicineId || req.params.medicineId;
  const periods = Math.min(Math.max(Number(req.body.periods) || 30, 1), 365);
  const targetMonthReq = req.body.targetMonth ? Number(req.body.targetMonth) : null;

  const medicine = await Medicine.findOne({ _id: medicineId, pharmacyId: pharmacyDbId });
  if (!medicine) {
    return res.status(404).json({ success: false, message: "Medicine not found in this pharmacy" });
  }

  // 1. Resolve Category
  const atcCategory = mapToAtcCategory(medicine.category);

  // 2. Compute completed pharmacy baseline (strictly excluding current incomplete month)
  const initialEstimate = medicine.leadTimeDays ? (medicine.leadTimeDays * 15) : 100;
  const baselineInfo = await calculatePharmacyBaseline(pharmacyDbId, medicine._id, initialEstimate);
  const pharmacyBaseline = baselineInfo.baseline;

  // 3. Determine target calendar month (default to next month)
  const nextMonth = targetMonthReq || ((new Date().getMonth() + 1) % 12 + 1);

  // 4. Calculate current stock from active batches
  const batches = await Inventory.find({ medicineId: medicine._id, pharmacyId: pharmacyDbId });
  const currentStock = batches.reduce((sum, b) => sum + (b.currentStock || 0), 0);

  // 5. Call ML microservice
  const mlResponse = await requestMlPrediction({
    medicine_id: medicine._id.toString(),
    category: atcCategory,
    target_month: nextMonth,
    periods,
    pharmacy_baseline: pharmacyBaseline
  });

  const normalizedFactor = Number(mlResponse.normalized_demand_factor) || 1.0;
  const totalDemand = Number(mlResponse.total_demand);
  const confidence = Number(mlResponse.confidence) || 0.80;
  const recommendedStock = Math.ceil(totalDemand * 1.2);

  // 6. Save / Update prediction history in MongoDB
  await Prediction.findOneAndUpdate(
    { pharmacyId: pharmacyDbId, medicineId: medicine._id },
    {
      predictedDemand: mlResponse.predicted_demand,
      confidence,
      source: mlResponse.source,
      predictionDate: new Date()
    },
    { upsert: true, returnDocument: "after" }
  );

  // 7. Inventory & Alert Flow: Trigger replenishment alert if current stock < predicted demand
  if (currentStock < totalDemand) {
    const existingAlert = await Alert.findOne({
      pharmacyId: pharmacyDbId,
      type: "LOW_STOCK",
      isResolved: false,
      message: new RegExp(`\\[Prediction\\] Replenishment needed for "${medicine.name}"`, "i")
    });

    if (!existingAlert) {
      const shortage = totalDemand - currentStock;
      const msg = `[Prediction] Replenishment needed for "${medicine.name}" (ID:${medicine._id}). Predicted demand: ${totalDemand} units over ${periods} days. Current stock: ${currentStock} units. Shortage: ${shortage} units.`;
      await Alert.create({
        pharmacyId: pharmacyDbId,
        inventoryId: null,
        type: "LOW_STOCK",
        message: msg,
        severity: currentStock === 0 ? "High" : "Medium"
      });
    }
  }

  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + periods);

  return res.json({
    success: true,
    data: {
      medicine: medicine.name,
      category: atcCategory,
      currentStock,
      pharmacyBaseline,
      baselineSource: baselineInfo.baselineSource,
      completedMonthsUsed: baselineInfo.completedMonthsCount,
      normalizedDemandFactor: normalizedFactor,
      predictedDemand: totalDemand,
      predictedDemandArray: mlResponse.predicted_demand,
      recommendedStock,
      confidence,
      source: mlResponse.source,
      periods,
      targetMonth: nextMonth,
      predictedDate: predictedDate.toLocaleDateString()
    }
  });
});

/**
 * Get prediction history for the current pharmacy tenant.
 */
export const getPredictionHistory = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const medicineId = req.query.medicineId;

  const queryObj = { pharmacyId: pharmacyDbId };
  if (medicineId) {
    queryObj.medicineId = medicineId;
  }

  const total = await Prediction.countDocuments(queryObj);
  const predictions = await Prediction.find(queryObj)
    .populate("medicineId")
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return res.json({
    success: true,
    data: predictions.map((p) => ({
      _id: p._id,
      id: p._id,
      medicineId: p.medicineId?._id,
      medicineName: p.medicineId?.name || "Unknown",
      medicineSku: p.medicineId?.sku || "",
      predictionDate: p.predictionDate,
      predictedDemand: p.predictedDemand,
      confidence: p.confidence,
      source: p.source,
      createdAt: p.createdAt
    })),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
  });
});
