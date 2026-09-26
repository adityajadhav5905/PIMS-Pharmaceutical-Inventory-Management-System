import { Alert } from "../models/index.js";
import { getPharmacyDbId } from "../utils/tenantContext.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listAlerts = asyncHandler(async (req, res) => {
  const pharmacyDbId = getPharmacyDbId();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const status = req.query.status || "";
  const type = req.query.type || "";

  const queryObj = { pharmacyId: pharmacyDbId };
  if (status === "resolved") {
    queryObj.isResolved = true;
  } else if (status === "active" || status === "unresolved") {
    queryObj.isResolved = false;
  }

  if (type) {
    queryObj.type = type;
  }

  const total = await Alert.countDocuments(queryObj);
  const alerts = await Alert.find(queryObj)
    .populate("inventoryId")
    .populate("closedBy", "name email")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return res.json({
    success: true,
    data: alerts.map((a) => ({
      _id: a._id,
      id: a._id,
      type: a.type,
      message: a.message,
      severity: a.severity,
      isResolved: a.isResolved,
      closedAt: a.closedAt,
      createdAt: a.createdAt,
      inventory: a.inventoryId ? {
        _id: a.inventoryId._id,
        id: a.inventoryId._id,
        batchNumber: a.inventoryId.batchNumber,
        currentStock: a.inventoryId.currentStock,
        reorderLevel: a.inventoryId.reorderLevel
      } : null,
      closedBy: a.closedBy ? {
        _id: a.closedBy._id,
        id: a.closedBy._id,
        name: a.closedBy.name,
        email: a.closedBy.email
      } : null
    })),
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
  const alert = await Alert.findOne({ _id: req.params.id, pharmacyId: pharmacyDbId }).populate("inventoryId");

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

  alert.isResolved = true;
  alert.closedAt = new Date();
  alert.closedBy = req.user?.sub || null;
  await alert.save();

  return res.json({
    success: true,
    message: "Alert closed successfully",
    data: {
      _id: alert._id,
      id: alert._id,
      isResolved: alert.isResolved,
      closedAt: alert.closedAt
    }
  });
});
