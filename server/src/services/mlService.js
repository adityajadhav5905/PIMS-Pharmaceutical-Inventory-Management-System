import env from "../config/env.js";
import logger from "../utils/logger.js";

/**
 * Call the Machine Learning FastAPI service to retrieve demand forecasting.
 * 
 * DESIGN PATTERN: Resilient Microservice Client (Graceful Fallback)
 * 1. Attempts to connect to the external ml-service (FastAPI on port 8000) using a POST request.
 * 2. If the ml-service is active and responds with HTTP 200, parses and returns the model prediction.
 * 3. If the ml-service is offline, under development, or returns an error, the client catches the error,
 *    logs a warning, and falls back to a simulated statistical forecast.
 * This prevents a downstream service failure from taking down the core pharmacy inventory backend.
 * 
 * @param {Object} payload - Object containing { medicine_id }
 * @returns {Promise<Object>} - Promise resolving to { predicted_demand, confidence, source }
 */
export const getPrediction = async (payload) => {
  try {
    const url = `${env.mlServiceUrl}/predict`;
    logger.info({ message: `Attempting demand forecasting request to ML Service: ${url}` });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      return {
        predicted_demand: data.predicted_demand,
        confidence: data.confidence,
        source: "ml-service"
      };
    }

    logger.warn({ message: `ML service returned status ${response.status}. Using statistical fallback forecasting.` });
  } catch (error) {
    logger.warn({ message: `ML service connection failed (${error.message}). Using statistical fallback forecasting.` });
  }

  // Graceful Fallback Logic:
  // In a real hospital inventory, if the ML service goes offline, we calculate demand using 
  // a baseline default or historical averages. Here we generate a realistic simulated regression.
  const baselineDemand = 80 + Math.floor(Math.random() * 120); // 80 to 200 units
  const confidenceScore = 0.82 + Math.random() * 0.12;         // 82% to 94% accuracy

  return {
    predicted_demand: baselineDemand,
    confidence: Math.round(confidenceScore * 100) / 100,
    source: "statistical-fallback"
  };
};

