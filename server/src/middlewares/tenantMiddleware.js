import { tenantStorage } from "../utils/tenantContext.js";
import { verifyAccessToken } from "../config/jwt.js";
import { Pharmacy } from "../models/Pharmacy.js";

export const tenantMiddleware = async (req, res, next) => {
  let pharmacyId = null;

  // 1. If an authorization token is present, the verified token's pharmacyId is authoritative
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      pharmacyId = decoded.pharmacyId;
    } catch {
      // Invalid/expired token will be handled by requireAuth
    }
  }

  // 2. Only for unauthenticated endpoints, fall back to headers or query params
  if (!pharmacyId) {
    pharmacyId = req.headers["x-pharmacy-id"] || req.headers["x-tenant-id"] || req.query.pharmacyId;
  }

  if (pharmacyId) {
    try {
      const cleanSlug = String(pharmacyId).toLowerCase().trim();
      const pharmacy = await Pharmacy.findOne({ slug: cleanSlug });
      const pharmacyDbId = pharmacy ? pharmacy._id : null;
      tenantStorage.run({ pharmacyId: cleanSlug, pharmacyDbId }, next);
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
};
