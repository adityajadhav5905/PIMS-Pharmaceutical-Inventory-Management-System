import { Router } from "express";
import Joi from "joi";
import { runPrediction, getPredictionHistory } from "../controllers/predictionController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validate.js";

const router = Router();

const schema = Joi.object({
  medicineId: Joi.alternatives()
    .try(Joi.string().trim().min(1), Joi.number().integer().positive())
    .required(),
  periods: Joi.number().integer().min(1).max(365).default(30).optional()
});

router.post("/", requireAuth, validateBody(schema), runPrediction);
router.get("/history", requireAuth, getPredictionHistory);

export default router;
