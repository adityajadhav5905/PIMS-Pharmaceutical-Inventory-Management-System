import logger from "../utils/logger.js";

export default function errorHandler(err, req, res, next) {
  logger.error({ message: err.message, stack: err.stack, path: req.path });
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
}
