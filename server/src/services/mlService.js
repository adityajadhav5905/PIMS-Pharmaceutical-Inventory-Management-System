import env from "../config/env.js";
import logger from "../utils/logger.js";

/**
 * Seasonal baseline factors by ATC category (for resilient statistical fallback if FastAPI service is offline).
 */
const FALLBACK_CATEGORY_FACTORS = {
  M01AB: { 1: 1.04, 2: 0.98, 3: 1.08, 4: 1.02, 5: 1.05, 6: 0.96, 7: 1.03, 8: 1.08, 9: 1.02, 10: 1.05, 11: 1.04, 12: 1.01 },
  M01AE: { 1: 0.93, 2: 0.95, 3: 0.98, 4: 1.01, 5: 1.02, 6: 1.00, 7: 1.01, 8: 0.97, 9: 1.02, 10: 1.01, 11: 0.93, 12: 0.96 },
  N02BA: { 1: 1.09, 2: 1.01, 3: 0.98, 4: 1.02, 5: 0.99, 6: 1.01, 7: 1.02, 8: 0.99, 9: 1.00, 10: 1.02, 11: 1.09, 12: 1.03 },
  N02BE: { 1: 1.00, 2: 0.95, 3: 0.98, 4: 0.88, 5: 0.82, 6: 0.80, 7: 0.85, 8: 0.89, 9: 1.15, 10: 1.25, 11: 1.00, 12: 1.10 },
  N05B:  { 1: 0.94, 2: 0.98, 3: 0.95, 4: 0.98, 5: 1.02, 6: 1.01, 7: 1.03, 8: 1.02, 9: 1.01, 10: 1.02, 11: 0.94, 12: 0.97 },
  N05C:  { 1: 1.28, 2: 0.85, 3: 0.90, 4: 0.82, 5: 0.88, 6: 0.92, 7: 0.95, 8: 1.05, 9: 1.10, 10: 1.15, 11: 1.28, 12: 1.20 },
  R03:   { 1: 1.28, 2: 1.15, 3: 1.05, 4: 0.90, 5: 0.85, 6: 0.92, 7: 0.88, 8: 0.82, 9: 1.10, 10: 1.22, 11: 1.28, 12: 1.30 },
  R06:   { 1: 0.66, 2: 0.72, 3: 1.15, 4: 1.65, 5: 1.75, 6: 1.55, 7: 1.10, 8: 0.95, 9: 0.85, 10: 0.75, 11: 0.66, 12: 0.60 }
};

/**
 * Call the Machine Learning FastAPI service to retrieve demand forecasting.
 *
 * @param {Object} payload - { medicine_id, category, target_month, periods, pharmacy_baseline }
 */
export const getPrediction = async (payloadOrMedId, optionalPeriods) => {
  let medicineId;
  let category = "M01AB";
  let targetMonth = null;
  let periods = 30;
  let pharmacyBaseline = 100.0;

  if (typeof payloadOrMedId === "object" && payloadOrMedId !== null) {
    medicineId = payloadOrMedId.medicine_id || payloadOrMedId.medicineId;
    category = payloadOrMedId.category || category;
    targetMonth = payloadOrMedId.target_month || payloadOrMedId.targetMonth || null;
    periods = payloadOrMedId.periods || 30;
    pharmacyBaseline = payloadOrMedId.pharmacy_baseline ?? payloadOrMedId.pharmacyBaseline ?? 100.0;
  } else {
    medicineId = payloadOrMedId;
    periods = optionalPeriods || 30;
  }

  periods = Number(periods) || 30;
  pharmacyBaseline = Number(pharmacyBaseline) || 100.0;

  // Infer next calendar month if not provided
  if (!targetMonth) {
    const nextMonth = (new Date().getMonth() + 1) % 12 + 1;
    targetMonth = nextMonth;
  }

  try {
    const url = `${env.mlServiceUrl}/predict`;
    logger.info({ message: `Calling ML service: ${url} (Category: ${category}, Month: ${targetMonth}, Baseline: ${pharmacyBaseline})` });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicine_id: String(medicineId),
        category: String(category),
        target_month: targetMonth,
        periods,
        pharmacy_baseline: pharmacyBaseline
      })
    });

    if (response.ok) {
      const data = await response.json();
      const demandArray = Array.isArray(data.predicted_demand)
        ? data.predicted_demand.map(Number)
        : [Number(data.predicted_demand)];
      const totalDemand = typeof data.total_demand === "number"
        ? data.total_demand
        : demandArray.reduce((a, b) => a + b, 0);
      const factor = typeof data.normalized_demand_factor === "number"
        ? data.normalized_demand_factor
        : 1.0;

      return {
        category: data.category || category,
        normalized_demand_factor: factor,
        predicted_demand: demandArray,
        total_demand: totalDemand,
        confidence: data.confidence,
        source: "ml-service",
        periods: data.periods || periods,
        target_month: targetMonth
      };
    }

    logger.warn({ message: `ML service returned status ${response.status}. Using statistical fallback.` });
  } catch (error) {
    logger.warn({ message: `ML service connection failed (${error.message}). Using statistical fallback.` });
  }

  // Graceful Statistical Fallback: Use category seasonal table and pharmacy baseline
  const catKey = String(category).toUpperCase().trim();
  const catTable = FALLBACK_CATEGORY_FACTORS[catKey] || FALLBACK_CATEGORY_FACTORS.M01AB;
  const factor = catTable[targetMonth] || 1.0;
  
  const monthlyScale = factor * pharmacyBaseline;
  const dailyRate = Math.max(1, Math.round(monthlyScale / 30.0));
  const demandArray = Array.from({ length: periods }, () => dailyRate);
  const totalDemand = demandArray.reduce((a, b) => a + b, 0);
  const confidenceScore = 0.78;

  return {
    category: catKey,
    normalized_demand_factor: factor,
    predicted_demand: demandArray,
    total_demand: totalDemand,
    confidence: confidenceScore,
    source: "statistical-fallback",
    periods,
    target_month: targetMonth
  };
};

export const requestMlPrediction = getPrediction;
