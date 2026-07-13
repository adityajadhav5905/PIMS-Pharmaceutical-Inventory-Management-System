import cron from "node-cron";
import Inventory from "../models/Inventory.js";
import Alert from "../models/Alert.js";
import logger from "../utils/logger.js";

/**
 * Evaluates stock thresholds and expiry conditions for a specific batch.
 * Instantly generates alerts if thresholds are breached, preventing delays from the cron schedule.
 */
export const checkAlertsForBatch = async (batchId) => {
  try {
    const row = await Inventory.findById(batchId).populate("medicine");
    if (!row) return;

    const now = new Date();

    // --- 1. Check for Low Stock ---
    if (row.currentStock <= row.reorderLevel) {
      // Verify if there is already an active, unresolved alert of type LOW_STOCK for this batch
      const activeAlertExists = await Alert.findOne({
        inventory: row._id,
        type: "LOW_STOCK",
        isResolved: false
      });

      // Create alert only if none currently exist to prevent duplicates
      if (!activeAlertExists) {
        await Alert.create({
          inventory: row._id,
          type: "LOW_STOCK",
          message: `${row.medicine?.name || "Medicine"} (Batch: ${row.batchNumber}) is below reorder level. Current stock: ${row.currentStock} units (Reorder limit: ${row.reorderLevel} units).`,
          severity: row.currentStock === 0 ? "High" : "Medium"
        });
        logger.info({ message: `Low stock alert generated for medicine batch: ${row.batchNumber}` });
      }
    }

    // --- 2. Check for Approaching Expiry ---
    const daysToExpiry = (row.expiryDate - now) / (1000 * 60 * 60 * 24);
    if (daysToExpiry <= 30) {
      // Verify if there is already an active, unresolved alert of type EXPIRY_WARNING for this batch
      const activeAlertExists = await Alert.findOne({
        inventory: row._id,
        type: "EXPIRY_WARNING",
        isResolved: false
      });

      // Create alert only if none currently exist
      if (!activeAlertExists) {
        const severity = daysToExpiry <= 7 ? "High" : (daysToExpiry <= 14 ? "Medium" : "Low");
        await Alert.create({
          inventory: row._id,
          type: "EXPIRY_WARNING",
          message: `${row.medicine?.name || "Medicine"} batch ${row.batchNumber} is expiring in ${Math.ceil(daysToExpiry)} days (Expiry: ${row.expiryDate.toDateString()}).`,
          severity
        });
        logger.info({ message: `Expiry warning alert generated for batch: ${row.batchNumber}` });
      }
    }
  } catch (err) {
    logger.error({ message: `Failed to run alerts validation check for batch ${batchId}: ${err.message}`, stack: err.stack });
  }
};

/**
 * Start Alert Job Scheduler
 * Runs a background cron job once every hour (at minute 0) to evaluate all inventory rows.
 */
export const startAlertJob = () => {
  // Cron syntax: "0 * * * *" runs at the start of every hour
  cron.schedule("0 * * * *", async () => {
    logger.info({ message: "Running background inventory alert validation job..." });
    
    try {
      const inventoryRows = await Inventory.find();
      for (const row of inventoryRows) {
        await checkAlertsForBatch(row._id);
      }
    } catch (err) {
      logger.error({ message: `Failed to run background alert job: ${err.message}`, stack: err.stack });
    }
  });
};
