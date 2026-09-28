import cron from "node-cron";
import logger from "../utils/logger.js";
import { tenantStorage } from "../utils/tenantContext.js";
import { Inventory, Alert } from "../models/index.js";

/**
 * Base abstract Strategy class for Alert evaluation.
 */
class AlertStrategy {
  constructor(type) {
    if (new.target === AlertStrategy) {
      throw new TypeError("Cannot construct AlertStrategy instances directly");
    }
    this.type = type;
  }

  async check(batch, pharmacyDbId, pharmacyId) {
    throw new Error("Must implement check() method in subclasses");
  }
}

/** Strategy for Low Stock condition checks. */
class LowStockStrategy extends AlertStrategy {
  constructor() {
    super("LOW_STOCK");
  }

  async check(batch, pharmacyDbId, pharmacyId) {
    const medName = batch.medicineId?.name || "Medicine";
    if (batch.currentStock <= batch.reorderLevel) {
      const message = `${medName} (Batch: ${batch.batchNumber}) is below reorder level. Current stock: ${batch.currentStock} units (Reorder limit: ${batch.reorderLevel} units).`;
      const severity = batch.currentStock === 0 ? "High" : "Medium";

      const alert = await Alert.findOneAndUpdate(
        {
          pharmacyId: pharmacyDbId,
          inventoryId: batch._id,
          type: "LOW_STOCK",
          isResolved: false
        },
        {
          $setOnInsert: {
            pharmacyId: pharmacyDbId,
            inventoryId: batch._id,
            type: "LOW_STOCK",
            message,
            severity,
            isResolved: false
          }
        },
        { upsert: true, returnDocument: "after" }
      );

      if (alert) {
        logger.info({ message: `Low stock alert verified for batch: ${batch.batchNumber} (Tenant: ${pharmacyId})` });
      }
    } else {
      const result = await Alert.updateMany(
        {
          pharmacyId: pharmacyDbId,
          inventoryId: batch._id,
          type: "LOW_STOCK",
          isResolved: false
        },
        {
          $set: {
            isResolved: true,
            closedAt: new Date()
          }
        }
      );
      if (result.modifiedCount > 0) {
        logger.info({ message: `Low stock alert auto-resolved for batch: ${batch.batchNumber} (Tenant: ${pharmacyId})` });
      }
    }
  }
}

/** Strategy for Overstock condition checks. */
class OverstockStrategy extends AlertStrategy {
  constructor() {
    super("OVERSTOCK");
  }

  async check(batch, pharmacyDbId, pharmacyId) {
    const medName = batch.medicineId?.name || "Medicine";
    const overstockThreshold = batch.reorderLevel * 3;
    if (batch.currentStock > overstockThreshold) {
      const message = `${medName} (Batch: ${batch.batchNumber}) is overstocked. Current stock: ${batch.currentStock} units (Reorder limit: ${batch.reorderLevel} units, Overstock limit: ${overstockThreshold} units).`;

      const alert = await Alert.findOneAndUpdate(
        {
          pharmacyId: pharmacyDbId,
          inventoryId: batch._id,
          type: "OVERSTOCK",
          isResolved: false
        },
        {
          $setOnInsert: {
            pharmacyId: pharmacyDbId,
            inventoryId: batch._id,
            type: "OVERSTOCK",
            message,
            severity: "Low",
            isResolved: false
          }
        },
        { upsert: true, returnDocument: "after" }
      );

      if (alert) {
        logger.info({ message: `Overstock alert verified for batch: ${batch.batchNumber} (Tenant: ${pharmacyId})` });
      }
    } else {
      const result = await Alert.updateMany(
        {
          pharmacyId: pharmacyDbId,
          inventoryId: batch._id,
          type: "OVERSTOCK",
          isResolved: false
        },
        {
          $set: {
            isResolved: true,
            closedAt: new Date()
          }
        }
      );
      if (result.modifiedCount > 0) {
        logger.info({ message: `Overstock alert auto-resolved for batch: ${batch.batchNumber} (Tenant: ${pharmacyId})` });
      }
    }
  }
}

/** Strategy for Expiry condition warning checks. */
class ExpiryStrategy extends AlertStrategy {
  constructor() {
    super("EXPIRY_WARNING");
  }

  async check(batch, pharmacyDbId, pharmacyId) {
    const medName = batch.medicineId?.name || "Medicine";
    const now = new Date();
    const daysToExpiry = (new Date(batch.expiryDate) - now) / (1000 * 60 * 60 * 24);

    if (daysToExpiry <= 30) {
      const severity = daysToExpiry <= 7 ? "High" : (daysToExpiry <= 14 ? "Medium" : "Low");
      const expiryString = new Date(batch.expiryDate).toDateString();
      const message = `${medName} batch ${batch.batchNumber} is expiring in ${Math.ceil(daysToExpiry)} days (Expiry: ${expiryString}).`;

      const alert = await Alert.findOneAndUpdate(
        {
          pharmacyId: pharmacyDbId,
          inventoryId: batch._id,
          type: "EXPIRY_WARNING",
          isResolved: false
        },
        {
          $setOnInsert: {
            pharmacyId: pharmacyDbId,
            inventoryId: batch._id,
            type: "EXPIRY_WARNING",
            message,
            severity,
            isResolved: false
          }
        },
        { upsert: true, returnDocument: "after" }
      );

      if (alert) {
        logger.info({ message: `Expiry warning alert verified for batch: ${batch.batchNumber} (Tenant: ${pharmacyId})` });
      }
    } else {
      const result = await Alert.updateMany(
        {
          pharmacyId: pharmacyDbId,
          inventoryId: batch._id,
          type: "EXPIRY_WARNING",
          isResolved: false
        },
        {
          $set: {
            isResolved: true,
            closedAt: new Date()
          }
        }
      );
      if (result.modifiedCount > 0) {
        logger.info({ message: `Expiry warning alert auto-resolved for batch: ${batch.batchNumber} (Tenant: ${pharmacyId})` });
      }
    }
  }
}

const strategies = [
  new LowStockStrategy(),
  new OverstockStrategy(),
  new ExpiryStrategy()
];

/**
 * Evaluates stock thresholds and expiry conditions on a batch.
 */
export const checkAlertsForBatch = async (batchId) => {
  try {
    const batch = await Inventory.findById(batchId).populate("medicineId").populate("pharmacyId");
    if (!batch) return;

    const pharmacyDbId = batch.pharmacyId?._id || batch.pharmacyId;
    const pharmacyId = batch.pharmacyId?.slug || "";

    await tenantStorage.run({ pharmacyId, pharmacyDbId }, async () => {
      for (const strategy of strategies) {
        await strategy.check(batch, pharmacyDbId, pharmacyId);
      }
    });
  } catch (err) {
    logger.error({ message: `Failed to run alerts validation for batch ${batchId}: ${err.message}`, stack: err.stack });
  }
};

/**
 * Start Alert Job Scheduler cron.
 */
export const startAlertJob = () => {
  cron.schedule("0 * * * *", async () => {
    logger.info({ message: "Running background inventory alert validation job..." });

    try {
      const batches = await Inventory.find({}).select("_id");
      for (const b of batches) {
        await checkAlertsForBatch(b._id);
      }
    } catch (err) {
      logger.error({ message: `Failed to run background alert job: ${err.message}`, stack: err.stack });
    }
  });
};
