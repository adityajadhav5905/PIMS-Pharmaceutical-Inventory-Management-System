import { Alert } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listAlerts = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const status = req.query.status || "";
  const type = req.query.type || "";

  const { total, rows } = await Alert.findByPharmacyPaginated(pharmacyDbId, { page, limit, status, type });

  return res.json({
    success: true,
    data: rows,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

export const getAlert = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const alert = await Alert.findByIdAndPharmacy(req.params.id, pharmacyDbId);

  if (!alert) {
    return res.status(404).json({ success: false, message: "Alert not found" });
  }

  return res.json({
    success: true,
    data: {
      _id: alert._id,
      id: alert._id,
      type: alert.type,
      message: alert.message,
      severity: alert.severity,
      isResolved: alert.isResolved,
      closedAt: alert.closedAt,
      createdAt: alert.createdAt
    }
  });
});

export const createAlert = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const { inventoryId, type, message, severity } = req.body;

  const alert = await Alert.create({
    pharmacyId: pharmacyDbId,
    inventoryId: inventoryId || null,
    type: type || "LOW_STOCK",
    message,
    severity: severity || "Medium",
    isResolved: false
  });

  return res.status(201).json({
    success: true,
    data: {
      _id: alert._id,
      id: alert._id,
      type: alert.type,
      message: alert.message,
      severity: alert.severity,
      isResolved: alert.isResolved
    }
  });
});

export const closeAlert = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const alert = await Alert.findOne({ _id: req.params.id, pharmacyId: pharmacyDbId });

  if (!alert) {
    return res.status(404).json({ success: false, message: "Alert not found" });
  }

  const closedAt = new Date();
  const closedBy = req.user?.sub || null;

  await Alert.updateById(alert.id || alert._id, {
    isResolved: 1,
    closedAt,
    closedBy
  });

  return res.json({
    success: true,
    message: "Alert closed successfully",
    data: {
      _id: alert._id,
      id: alert._id,
      isResolved: true,
      closedAt
    }
  });
});
