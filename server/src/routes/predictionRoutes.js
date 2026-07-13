import { Router } from "express";
import Joi from "joi";
import { runPrediction } from "../controllers/predictionController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { validateBody } from "../middlewares/validate.js";

const router = Router();
const schema = Joi.object({ medicineId: Joi.string().required() });

router.post("/", requireAuth, validateBody(schema), runPrediction);

export default router;
