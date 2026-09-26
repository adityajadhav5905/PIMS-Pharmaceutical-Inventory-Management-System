import { verifyAccessToken } from "../config/jwt.js";

export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export const requireRole = (roles) => (req, res, next) => {
  const allowed = roles.map((r) => r.toLowerCase());
  const userRole = (req.user?.role || "").toLowerCase();
  if (!allowed.includes(userRole)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  return next();
};
